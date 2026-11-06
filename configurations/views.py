"""
Configurations app views (Phase 23 + 25).

Endpoints:
    /settings/                → school settings form (admin only)
    /settings/database/       → database management (audit logs + backup)
    /settings/database/backup/→ trigger a manual SQLite backup
"""
import os
import shutil
from datetime import datetime

from django.conf import settings
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
from django.http import HttpResponse
from django.shortcuts import render, redirect

from accounts.models import SystemLog, LoginLog
from accounts.permissions import role_required
from .forms import SchoolSettingsForm, DatabaseBackupForm
from .models import SchoolSettings


@login_required
@role_required('Administrator')
def school_settings(request):
    """School configuration form (Phase 25)."""
    obj = SchoolSettings.get_settings()
    if request.method == 'POST':
        form = SchoolSettingsForm(request.POST, request.FILES, instance=obj)
        if form.is_valid():
            updated = form.save(commit=False)
            updated.updated_by = request.user
            updated.save()
            SystemLog.log(
                user=request.user, action=SystemLog.ACTION_UPDATE, entity='SchoolSettings',
                entity_id=updated.pk, description='Updated school settings', request=request,
            )
            messages.success(request, 'School settings updated successfully.')
            return redirect('configurations:school_settings')
    else:
        form = SchoolSettingsForm(instance=obj)
    return render(request, 'settings/school_settings.html', {'form': form, 'settings_obj': obj, 'section': 'settings'})


@login_required
@role_required('Administrator')
def database(request):
    """Database management — audit log viewer (Phase 23)."""
    logs = SystemLog.objects.select_related('user').all().order_by('-timestamp')

    # Optional filters
    entity = request.GET.get('entity')
    action = request.GET.get('action')
    if entity:
        logs = logs.filter(entity__icontains=entity)
    if action:
        logs = logs.filter(action=action)

    paginator = Paginator(logs, 25)
    page_obj = paginator.get_page(request.GET.get('page'))

    # Summary counts
    summary = {
        'total_logs': SystemLog.objects.count(),
        'total_logins': LoginLog.objects.count(),
        'logins_today': LoginLog.objects.filter(action='login', timestamp__date=datetime.now().date()).count(),
        'failed_logins': LoginLog.objects.filter(action='failed').count(),
    }

    return render(request, 'settings/database.html', {
        'logs': page_obj, 'summary': summary,
        'entities': SystemLog.objects.values_list('entity', flat=True).distinct(),
        'actions': SystemLog.ACTION_CHOICES, 'section': 'settings',
    })


@login_required
@role_required('Administrator')
def database_backup(request):
    """Trigger a manual SQLite backup (Phase 23)."""
    if request.method == 'POST':
        form = DatabaseBackupForm(request.POST)
        if form.is_valid():
            db_path = settings.DATABASES['default']['NAME']
            backup_dir = os.path.join(settings.BASE_DIR, 'backups')
            os.makedirs(backup_dir, exist_ok=True)
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            backup_path = os.path.join(backup_dir, f'db_backup_{timestamp}.sqlite3')
            try:
                shutil.copy2(db_path, backup_path)
                SystemLog.log(
                    user=request.user, action=SystemLog.ACTION_BACKUP, entity='Database',
                    entity_id=0, description=f'Manual backup created: {os.path.basename(backup_path)}',
                    request=request,
                )
                messages.success(request, f'Database backup created: {os.path.basename(backup_path)}')
                # Offer the file for download
                with open(backup_path, 'rb') as f:
                    response = HttpResponse(f.read(), content_type='application/x-sqlite3')
                    response['Content-Disposition'] = f'attachment; filename="{os.path.basename(backup_path)}"'
                    return response
            except Exception as e:
                messages.error(request, f'Backup failed: {e}')
        else:
            messages.error(request, 'Please confirm the backup action.')
    return redirect('configurations:database')


@login_required
@role_required('Administrator')
def database_restore(request):
    """Restore the database from an uploaded .sqlite3 backup file.

    Safety flow:
        1. Creates a safety backup of the current db (pre_restore_<timestamp>.sqlite3)
        2. Saves the uploaded file
        3. Replaces the active db.sqlite3
        4. Logs the restore action
        5. Redirects back to the database page with a success message
    """
    if request.method == 'POST':
        confirm = request.POST.get('confirm', '')
        if confirm != 'true':
            messages.error(request, 'Please confirm the restore action.')
            return redirect('configurations:database')

        uploaded_file = request.FILES.get('file')
        if not uploaded_file:
            messages.error(request, 'No file uploaded. Please select a .sqlite3 backup file.')
            return redirect('configurations:database')

        # Validate the file extension
        if not (uploaded_file.name.endswith('.sqlite3') or uploaded_file.name.endswith('.sqlite') or uploaded_file.name.endswith('.db')):
            messages.error(request, 'Invalid file type. Please upload a .sqlite3 backup file.')
            return redirect('configurations:database')

        # Validate file size (limit to 100 MB)
        if uploaded_file.size > 100 * 1024 * 1024:
            messages.error(request, 'File too large. Maximum allowed size is 100 MB.')
            return redirect('configurations:database')

        db_path = settings.DATABASES['default']['NAME']
        backup_dir = os.path.join(settings.BASE_DIR, 'backups')
        os.makedirs(backup_dir, exist_ok=True)

        try:
            # 1. Create a safety backup of the current database
            safety_filename = f'pre_restore_{datetime.now().strftime("%Y%m%d_%H%M%S")}.sqlite3'
            safety_path = os.path.join(backup_dir, safety_filename)
            shutil.copy2(db_path, safety_path)

            # 2. Save the uploaded file
            temp_path = os.path.join(backup_dir, f'restore_temp_{datetime.now().strftime("%Y%m%d_%H%M%S")}.sqlite3')
            with open(temp_path, 'wb') as f:
                for chunk in uploaded_file.chunks():
                    f.write(chunk)

            # 3. Replace the active database file
            shutil.move(temp_path, db_path)

            SystemLog.log(
                user=request.user, action=SystemLog.ACTION_RESTORE, entity='Database',
                entity_id=0,
                description=f'Database restored from {uploaded_file.name} (safety backup: {safety_filename})',
                request=request,
            )
            messages.success(
                request,
                f'Database restored successfully from "{uploaded_file.name}". '
                f'A safety backup was created ({safety_filename}). '
                f'Please restart the Django server for the changes to take full effect.'
            )
        except Exception as e:
            messages.error(request, f'Restore failed: {e}')
    return redirect('configurations:database')

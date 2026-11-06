"""
Counseling app views (Phase 14-15).

Endpoints:
    /counseling/                → list with filters
    /counseling/create/         → create session
    /counseling/<pk>/           → detail view with notes
    /counseling/<pk>/edit/      → edit
    /counseling/<pk>/close/     → mark as closed
    /counseling/<pk>/notes/add/ → add a counselor note
    /counseling/<pk>/delete/    → delete
"""
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
from django.db.models import Q
from django.shortcuts import render, redirect, get_object_or_404
from django.utils import timezone

from accounts.models import SystemLog
from accounts.permissions import can
from students.models import ActivityTimeline
from .forms import CounselingSessionForm, CounselorNoteForm, CounselingFilterForm
from .models import CounselingSession, CounselorNote


@login_required
def counseling_list(request):
    qs = CounselingSession.objects.select_related('student', 'counselor')

    form = CounselingFilterForm(request.GET or None)
    if form.is_valid():
        s = form.cleaned_data.get('search')
        counselor = form.cleaned_data.get('counselor')
        concern = form.cleaned_data.get('concern_type')
        status = form.cleaned_data.get('status')
        date_from = form.cleaned_data.get('date_from')
        date_to = form.cleaned_data.get('date_to')
        if s:
            qs = qs.filter(
                Q(student__first_name__icontains=s) |
                Q(student__last_name__icontains=s) |
                Q(summary__icontains=s) |
                Q(notes__icontains=s)
            )
        if counselor:
            qs = qs.filter(counselor=counselor)
        if concern:
            qs = qs.filter(concern_type=concern)
        if status:
            qs = qs.filter(status=status)
        if date_from:
            qs = qs.filter(session_date__gte=date_from)
        if date_to:
            qs = qs.filter(session_date__lte=date_to)

    # Counselors see only their own sessions unless admin
    user = request.user
    if user.is_counselor and not user.is_administrator and not user.is_guidance_staff:
        qs = qs.filter(counselor=user)

    qs = qs.order_by('-session_date', '-created_at')
    paginator = Paginator(qs, 15)
    sessions = paginator.get_page(request.GET.get('page'))

    return render(request, 'counseling/list.html', {
        'sessions': sessions, 'filter_form': form, 'section': 'counseling',
    })


@login_required
def counseling_create(request):
    initial = {}
    student_id = request.GET.get('student')
    if student_id:
        initial['student'] = student_id
    if request.method == 'POST':
        form = CounselingSessionForm(request.POST)
        if form.is_valid():
            session = form.save(commit=False)
            session.created_by = request.user
            if not session.counselor_id:
                session.counselor = request.user
            session.save()
            ActivityTimeline.objects.create(
                student=session.student, activity_type='counseling',
                title=f'Counseling session: {session.get_concern_type_display()}',
                description=f'Session on {session.session_date} with {session.counselor.full_name}',
                performed_by=request.user, related_object_id=str(session.pk),
            )
            SystemLog.log(
                user=request.user, action=SystemLog.ACTION_CREATE, entity='CounselingSession',
                entity_id=session.pk, description=f'Created counseling session for {session.student}',
                request=request,
            )
            messages.success(request, 'Counseling session has been created.')
            return redirect('counseling:detail', pk=session.pk)
    else:
        form = CounselingSessionForm(initial=initial)
        if not form.initial.get('counselor') and request.user.is_counselor:
            form.initial['counselor'] = request.user
    return render(request, 'counseling/form.html', {'form': form, 'is_create': True, 'section': 'counseling'})


@login_required
def counseling_detail(request, pk):
    session = get_object_or_404(CounselingSession.objects.select_related('student', 'counselor'), pk=pk)
    notes = session.counselor_notes.select_related('author').all()
    if request.method == 'POST':
        note_form = CounselorNoteForm(request.POST)
        if note_form.is_valid():
            note = note_form.save(commit=False)
            note.session = session
            note.author = request.user
            note.save()
            messages.success(request, 'Note added.')
            return redirect('counseling:detail', pk=session.pk)
    else:
        note_form = CounselorNoteForm()
    return render(request, 'counseling/detail.html', {
        'session': session, 'notes': notes, 'note_form': note_form, 'section': 'counseling',
    })


@login_required
def counseling_edit(request, pk):
    session = get_object_or_404(CounselingSession, pk=pk)
    if request.method == 'POST':
        form = CounselingSessionForm(request.POST, instance=session)
        if form.is_valid():
            updated = form.save()
            SystemLog.log(
                user=request.user, action=SystemLog.ACTION_UPDATE, entity='CounselingSession',
                entity_id=updated.pk, description=f'Updated counseling session {updated.pk}',
                request=request,
            )
            messages.success(request, 'Session updated successfully.')
            return redirect('counseling:detail', pk=updated.pk)
    else:
        form = CounselingSessionForm(instance=session)
    return render(request, 'counseling/form.html', {
        'form': form, 'is_create': False, 'session': session, 'section': 'counseling',
    })


@login_required
def close(request, pk):
    session = get_object_or_404(CounselingSession, pk=pk)
    if request.method == 'POST':
        session.status = CounselingSession.STATUS_CLOSED
        session.closed_at = timezone.now()
        session.save()
        SystemLog.log(
            user=request.user, action=SystemLog.ACTION_UPDATE, entity='CounselingSession',
            entity_id=session.pk, description=f'Closed counseling session {session.pk}',
            request=request,
        )
        messages.success(request, 'Session has been closed.')
    return redirect('counseling:detail', pk=session.pk)


@login_required
def counseling_delete(request, pk):
    session = get_object_or_404(CounselingSession, pk=pk)
    if request.method == 'POST':
        SystemLog.log(
            user=request.user, action=SystemLog.ACTION_DELETE, entity='CounselingSession',
            entity_id=session.pk, description=f'Deleted counseling session {session.pk}',
            request=request,
        )
        session.delete()
        messages.success(request, 'Session deleted.')
        return redirect('counseling:list')
    return render(request, 'counseling/delete.html', {'session': session, 'section': 'counseling'})

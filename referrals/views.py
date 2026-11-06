"""
Referrals app views (Phase 16-17).

Endpoints:
    /referrals/             → list with filters
    /referrals/create/      → create referral
    /referrals/<pk>/        → detail with timeline + update form
    /referrals/<pk>/edit/   → edit
    /referrals/<pk>/close/  → mark completed
    /referrals/<pk>/delete/ → delete
"""
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
from django.db.models import Q
from django.shortcuts import render, redirect, get_object_or_404
from django.utils import timezone

from accounts.models import SystemLog
from accounts.permissions import can
from notifications.models import Notification
from students.models import ActivityTimeline
from .forms import ReferralForm, ReferralUpdateForm, ReferralFilterForm
from .models import Referral, ReferralUpdate


@login_required
def referral_list(request):
    qs = Referral.objects.select_related('student', 'referred_by', 'assigned_counselor')

    form = ReferralFilterForm(request.GET or None)
    if form.is_valid():
        s = form.cleaned_data.get('search')
        status = form.cleaned_data.get('status')
        priority = form.cleaned_data.get('priority')
        rtype = form.cleaned_data.get('referral_type')
        if s:
            matching_types = [value for value, label in Referral.REFERRAL_TYPES if s.lower() in label.lower()]
            qs = qs.filter(
                Q(student__first_name__icontains=s) |
                Q(student__last_name__icontains=s) |
                Q(reason__icontains=s) |
                Q(description__icontains=s) |
                Q(referral_type__icontains=s) |
                Q(referral_type__in=matching_types)
            )
        if status:
            qs = qs.filter(status=status)
        if priority:
            qs = qs.filter(priority=priority)
        if rtype:
            qs = qs.filter(referral_type=rtype)

    # Counselors see only referrals assigned to them
    user = request.user
    if user.is_counselor and not user.is_administrator and not user.is_guidance_staff:
        qs = qs.filter(assigned_counselor=user)

    qs = qs.order_by('-referred_at')
    paginator = Paginator(qs, 15)
    referrals = paginator.get_page(request.GET.get('page'))

    return render(request, 'referrals/list.html', {
        'referrals': referrals, 'filter_form': form, 'section': 'referrals',
    })


@login_required
def referral_create(request):
    initial = {}
    student_id = request.GET.get('student')
    if student_id:
        initial['student'] = student_id
    if request.method == 'POST':
        form = ReferralForm(request.POST)
        if form.is_valid():
            referral = form.save(commit=False)
            if not referral.referred_by_id:
                referral.referred_by = request.user
            referral.save()
            ActivityTimeline.objects.create(
                student=referral.student, activity_type='referral',
                title=f'New referral: {referral.get_referral_type_display()}',
                description=f'Priority: {referral.get_priority_display()}. Reason: {referral.reason[:120]}',
                performed_by=request.user, related_object_id=str(referral.pk),
            )
            SystemLog.log(
                user=request.user, action=SystemLog.ACTION_CREATE, entity='Referral',
                entity_id=referral.pk, description=f'Created referral #{referral.pk} for {referral.student}',
                request=request,
            )
            # Notify the assigned counselor (if any)
            if referral.assigned_counselor_id:
                Notification.objects.create(
                    user=referral.assigned_counselor,
                    category=Notification.CATEGORY_NEW_REFERRAL,
                    priority=Notification.PRIORITY_HIGH if referral.priority in ('high', 'urgent') else Notification.PRIORITY_NORMAL,
                    title=f'New referral assigned: {referral.student.full_name}',
                    message=f'You have been assigned a new {referral.get_referral_type_display()} referral. Priority: {referral.get_priority_display()}.',
                    link=f'/referrals/{referral.pk}/',
                )
            messages.success(request, 'Referral has been created.')
            return redirect('referrals:detail', pk=referral.pk)
    else:
        form = ReferralForm(initial=initial)
        form.initial['referred_by'] = request.user
    return render(request, 'referrals/form.html', {'form': form, 'is_create': True, 'section': 'referrals'})


@login_required
def referral_detail(request, pk):
    referral = get_object_or_404(Referral.objects.select_related('student', 'referred_by', 'assigned_counselor'), pk=pk)
    updates = referral.updates.select_related('author').all()

    if request.method == 'POST':
        update_form = ReferralUpdateForm(request.POST)
        if update_form.is_valid():
            update = update_form.save(commit=False)
            update.referral = referral
            update.author = request.user
            update.previous_status = referral.status
            update.save()
            referral.status = update.new_status
            if update.new_status == Referral.STATUS_COMPLETED:
                referral.completed_at = timezone.now()
            referral.save()
            SystemLog.log(
                user=request.user, action=SystemLog.ACTION_UPDATE, entity='Referral',
                entity_id=referral.pk, description=f'Referral #{referral.pk} status → {update.new_status}',
                request=request,
            )
            messages.success(request, 'Referral updated.')
            return redirect('referrals:detail', pk=referral.pk)
    else:
        update_form = ReferralUpdateForm(initial={'new_status': referral.status})

    return render(request, 'referrals/detail.html', {
        'referral': referral, 'updates': updates, 'update_form': update_form, 'section': 'referrals',
    })


@login_required
def referral_edit(request, pk):
    referral = get_object_or_404(Referral, pk=pk)
    if request.method == 'POST':
        form = ReferralForm(request.POST, instance=referral)
        if form.is_valid():
            updated = form.save()
            SystemLog.log(
                user=request.user, action=SystemLog.ACTION_UPDATE, entity='Referral',
                entity_id=updated.pk, description=f'Edited referral #{updated.pk}', request=request,
            )
            messages.success(request, 'Referral updated.')
            return redirect('referrals:detail', pk=updated.pk)
    else:
        form = ReferralForm(instance=referral)
    return render(request, 'referrals/form.html', {
        'form': form, 'is_create': False, 'referral': referral, 'section': 'referrals',
    })


@login_required
def close(request, pk):
    referral = get_object_or_404(Referral, pk=pk)
    if request.method == 'POST':
        prev = referral.status
        referral.status = Referral.STATUS_COMPLETED
        referral.completed_at = timezone.now()
        referral.save()
        ReferralUpdate.objects.create(
            referral=referral, author=request.user, previous_status=prev,
            new_status=Referral.STATUS_COMPLETED, note='Referral closed.',
        )
        SystemLog.log(
            user=request.user, action=SystemLog.ACTION_UPDATE, entity='Referral',
            entity_id=referral.pk, description=f'Closed referral #{referral.pk}', request=request,
        )
        messages.success(request, 'Referral marked as completed.')
    return redirect('referrals:detail', pk=referral.pk)


@login_required
def referral_delete(request, pk):
    referral = get_object_or_404(Referral, pk=pk)
    if request.method == 'POST':
        SystemLog.log(
            user=request.user, action=SystemLog.ACTION_DELETE, entity='Referral',
            entity_id=referral.pk, description=f'Deleted referral #{referral.pk}', request=request,
        )
        referral.delete()
        messages.success(request, 'Referral deleted.')
        return redirect('referrals:list')
    return render(request, 'referrals/delete.html', {'referral': referral, 'section': 'referrals'})

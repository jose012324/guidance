"""
Students app views (Phase 11-13).

Endpoints:
    /students/             → directory + filters + search + pagination
    /students/create/      → register a new student
    /students/<pk>/        → profile with tabs (personal/counseling/referral/timeline/docs)
    /students/<pk>/edit/   → edit student
    /students/<pk>/delete/ → delete student (with confirmation)
"""
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
from django.db.models import Q
from django.shortcuts import render, redirect, get_object_or_404

from accounts.models import SystemLog
from accounts.permissions import can, role_required
from students.models import Student, Guardian, StudentDocument, ActivityTimeline
from students.forms import StudentForm, GuardianForm, StudentDocumentForm, StudentFilterForm
from students.inventory_stats import get_student_inventory_data


@login_required
def record_inventory(request):
    """Overview of student records and related guidance activity."""
    return render(request, 'students/record_inventory.html', {
        'inventory_data': get_student_inventory_data(),
        'section': 'record_inventory',
    })


@login_required
def student_list(request):
    """Student directory with filters and search (Phase 11)."""
    qs = Student.objects.all()

    form = StudentFilterForm(request.GET or None)
    if form.is_valid():
        s = form.cleaned_data.get('search')
        grade = form.cleaned_data.get('grade_level')
        gender = form.cleaned_data.get('gender')
        status = form.cleaned_data.get('status')
        sy = form.cleaned_data.get('school_year')
        if s:
            qs = qs.filter(
                Q(first_name__icontains=s) | Q(last_name__icontains=s) |
                Q(middle_name__icontains=s) | Q(student_number__icontains=s)
            )
        if grade:
            qs = qs.filter(grade_level=grade)
        if gender:
            qs = qs.filter(gender=gender)
        if status:
            qs = qs.filter(status=status)
        if sy:
            qs = qs.filter(school_year__icontains=sy)

    qs = qs.order_by('last_name', 'first_name')
    paginator = Paginator(qs, 15)
    page = request.GET.get('page')
    students = paginator.get_page(page)

    return render(request, 'students/list.html', {
        'students': students, 'filter_form': form, 'section': 'students',
    })


@login_required
def student_create(request):
    """Register a new student (Phase 12)."""
    if request.method == 'POST':
        form = StudentForm(request.POST)
        if form.is_valid():
            student = form.save(commit=False)
            student.created_by = request.user
            student.save()
            ActivityTimeline.objects.create(
                student=student, activity_type='profile', title='Student record created',
                description=f'Created by {request.user.full_name}', performed_by=request.user,
            )
            SystemLog.log(
                user=request.user, action=SystemLog.ACTION_CREATE, entity='Student',
                entity_id=student.pk, description=f'Created student {student}',
                request=request,
            )
            messages.success(request, f'Student "{student.full_name}" has been registered.')
            return redirect('students:detail', pk=student.pk)
    else:
        form = StudentForm()
    return render(request, 'students/form.html', {'form': form, 'is_create': True, 'section': 'students'})


@login_required
def student_detail(request, pk):
    """Student profile with multiple tabs (Phase 13)."""
    student = get_object_or_404(Student, pk=pk)
    tab = request.GET.get('tab', 'personal')
    return render(request, 'students/detail.html', {
        'student': student, 'active_tab': tab, 'section': 'students',
        'counseling_sessions': student.counseling_sessions.all()[:20],
        'referrals': student.referrals.all()[:20],
        'activities': student.activities.all()[:20],
        'documents': student.documents.all(),
        'guardians': student.guardians.all(),
    })


@login_required
def student_edit(request, pk):
    student = get_object_or_404(Student, pk=pk)
    if request.method == 'POST':
        form = StudentForm(request.POST, instance=student)
        if form.is_valid():
            updated = form.save()
            ActivityTimeline.objects.create(
                student=updated, activity_type='profile', title='Profile updated',
                description=f'Updated by {request.user.full_name}', performed_by=request.user,
            )
            SystemLog.log(
                user=request.user, action=SystemLog.ACTION_UPDATE, entity='Student',
                entity_id=updated.pk, description=f'Updated student {updated}', request=request,
            )
            messages.success(request, f'Student "{updated.full_name}" has been updated.')
            return redirect('students:detail', pk=updated.pk)
    else:
        form = StudentForm(instance=student)
    return render(request, 'students/form.html', {
        'form': form, 'is_create': False, 'student': student, 'section': 'students',
    })


@login_required
def student_delete(request, pk):
    student = get_object_or_404(Student, pk=pk)
    if request.method == 'POST':
        label = str(student)
        SystemLog.log(
            user=request.user, action=SystemLog.ACTION_DELETE, entity='Student',
            entity_id=student.pk, description=f'Deleted student {label}', request=request,
        )
        student.delete()
        messages.success(request, f'Student "{label}" has been deleted.')
        return redirect('students:list')
    return render(request, 'students/delete.html', {'student': student, 'section': 'students'})


# ===========================================================================
# Guardian / Document sub-views (Phase 13)
# ===========================================================================
@login_required
def add_guardian(request, pk):
    student = get_object_or_404(Student, pk=pk)
    if request.method == 'POST':
        form = GuardianForm(request.POST)
        if form.is_valid():
            guardian = form.save(commit=False)
            guardian.student = student
            guardian.save()
            messages.success(request, f'Guardian "{guardian.full_name}" added.')
    return redirect(f'/students/{student.pk}/?tab=personal')


@login_required
def add_document(request, pk):
    student = get_object_or_404(Student, pk=pk)
    if request.method == 'POST':
        form = StudentDocumentForm(request.POST, request.FILES)
        if form.is_valid():
            doc = form.save(commit=False)
            doc.student = student
            doc.uploaded_by = request.user
            doc.save()
            ActivityTimeline.objects.create(
                student=student, activity_type='document', title=f'Document uploaded: {doc.title}',
                performed_by=request.user,
            )
            messages.success(request, f'Document "{doc.title}" uploaded.')
    return redirect(f'/students/{student.pk}/?tab=documents')

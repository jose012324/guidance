"""Shared, current database totals for the student record inventory screens."""
from datetime import timedelta

from django.db.models import Count, Q
from django.utils import timezone

from counseling.models import CounselingSession
from referrals.models import Referral

from .models import Student


def _choice_breakdown(model, field, choices):
    counts = {
        row[field]: row['value']
        for row in model.objects.order_by().values(field).annotate(value=Count('pk'))
    }
    return [{'label': label, 'value': counts.get(value, 0)} for value, label in choices]


def get_student_inventory_data():
    """Return the same summary for the browser page and desktop API."""
    total = Student.objects.count()
    students_with_records = Student.objects.filter(
        Q(counseling_sessions__isnull=False) | Q(referrals__isnull=False)
    ).distinct().count()
    referred_students = Referral.objects.values('student_id').distinct().count()
    counseling_students = CounselingSession.objects.values('student_id').distinct().count()

    programs = list(Student.objects.values('section').annotate(value=Count('pk')).order_by('-value', 'section'))
    program_breakdown = [
        {'label': row['section'] or 'Unspecified', 'value': row['value']}
        for row in programs[:5]
    ]
    if len(programs) > 5:
        program_breakdown.append({'label': 'Other courses/sections', 'value': sum(row['value'] for row in programs[5:])})

    return {
        'kpis': {
            'total_students': total,
            'active_students': Student.objects.filter(status=Student.STATUS_ACTIVE).count(),
            'inactive_students': Student.objects.filter(status=Student.STATUS_INACTIVE).count(),
            'newly_registered_students': Student.objects.filter(
                created_at__gte=timezone.now() - timedelta(days=30)
            ).count(),
            'with_guidance_records': students_with_records,
            'without_guidance_records': total - students_with_records,
            'active_cases': CounselingSession.objects.exclude(status=CounselingSession.STATUS_CLOSED).count()
                            + Referral.objects.exclude(status=Referral.STATUS_COMPLETED).count(),
            'closed_cases': CounselingSession.objects.filter(status=CounselingSession.STATUS_CLOSED).count()
                            + Referral.objects.filter(status=Referral.STATUS_COMPLETED).count(),
            'pending_referrals': Referral.objects.filter(status=Referral.STATUS_PENDING).count(),
            'referred_students': referred_students,
            'completed_referrals': Referral.objects.filter(status=Referral.STATUS_COMPLETED).count(),
            'urgent_cases': Referral.objects.filter(priority=Referral.PRIORITY_URGENT).exclude(
                status=Referral.STATUS_COMPLETED
            ).count(),
            'emergency_cases': Referral.objects.filter(
                referral_type='hospital_emergency_service'
            ).exclude(status=Referral.STATUS_COMPLETED).count(),
            'counseling_students': counseling_students,
        },
        'year_levels': _choice_breakdown(Student, 'grade_level', Student.GRADE_LEVELS),
        'programs': program_breakdown,
        'genders': _choice_breakdown(Student, 'gender', Student.GENDER_CHOICES),
        'concerns': _choice_breakdown(CounselingSession, 'concern_type', CounselingSession.CONCERN_TYPES),
        'referral_statuses': _choice_breakdown(Referral, 'status', Referral.STATUS_CHOICES),
    }

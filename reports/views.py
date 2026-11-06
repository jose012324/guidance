"""
Reports app views (Phase 22).

Generates reports across students, counseling, referrals, inventory, borrowing,
and user activity. Exports to CSV (built-in) — PDF/Excel stubs included for
future enhancement.

Endpoints:
    /reports/                  → reports center landing
    /reports/students/         → student report (CSV export)
    /reports/counseling/       → counseling report (CSV export)
    /reports/referrals/        → referral report (CSV export)
    /reports/inventory/        → inventory report (CSV export)
    /reports/borrowing/        → borrowing report (CSV export)
    /reports/user-activity/    → user activity report (CSV export)
"""
import csv
from datetime import timedelta

from django.contrib.auth.decorators import login_required
from django.http import HttpResponse, JsonResponse
from django.shortcuts import render
from django.utils import timezone
from django.utils.dateparse import parse_date

from accounts.models import User, SystemLog
from accounts.permissions import role_required
from counseling.models import CounselingSession
from inventory.models import InventoryItem, BorrowedItem, StockMovement
from referrals.models import Referral
from students.inventory_stats import get_student_inventory_data


# ----- Helpers -------------------------------------------------------------
def _csv_response(filename, header, rows):
    """Build a CSV HttpResponse with UTF-8 BOM for Excel compatibility."""
    response = HttpResponse(content_type='text/csv; charset=utf-8')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    response.write('\ufeff')  # UTF-8 BOM
    writer = csv.writer(response)
    writer.writerow(header)
    for row in rows:
        writer.writerow(row)
    return response


def _date_range_from_request(request):
    """Extract date_from / date_to from query params, defaulting to last 30 days.

    Always returns ``date`` objects (never the raw query string). Templates
    render these with ``{{ date_from|date:'Y-m-d' }}``; the ``date`` filter
    only formats date/datetime values, so returning a string would render an
    empty input and make the filter look cleared after Apply.
    """
    today = timezone.now().date()
    date_from = parse_date(request.GET.get('date_from') or '') or (today - timedelta(days=30))
    date_to = parse_date(request.GET.get('date_to') or '') or today
    return date_from, date_to


# Student Record Report — human-readable labels for the CSV export.
_STUDENT_REPORT_KPIS = [
    ('total_students', 'Total Registered Students'),
    ('active_students', 'Active Students'),
    ('inactive_students', 'Inactive Students'),
    ('newly_registered_students', 'Newly Registered Students'),
    ('with_guidance_records', 'With Guidance Records'),
    ('without_guidance_records', 'Without Guidance Records'),
    ('active_cases', 'Active Cases'),
    ('closed_cases', 'Closed Cases'),
    ('pending_referrals', 'Pending Referrals'),
    ('referred_students', 'Referred Students'),
    ('completed_referrals', 'Completed Referrals'),
    ('urgent_cases', 'Urgent Cases'),
    ('emergency_cases', 'Emergency Cases'),
    ('counseling_students', 'Students with Counseling Sessions'),
]

_STUDENT_REPORT_BREAKDOWNS = [
    ('year_levels', 'Students by Year Level'),
    ('programs', 'Students by Course & Section'),
    ('genders', 'Students by Gender'),
    ('concerns', 'Cases by Concern'),
    ('referral_statuses', 'Referral Status'),
]


# ----- Views ---------------------------------------------------------------
@login_required
@role_required('Administrator', 'Guidance Staff')
def home(request):
    """Reports center landing — overview of available reports."""
    return render(request, 'reports/home.html', {
        'section': 'reports',
        'report_types': [
            {'key': 'students', 'name': 'Student Record Report', 'description': 'Record inventory summary of student records.', 'icon': 'bi-mortarboard'},
            {'key': 'counseling', 'name': 'Counseling Report', 'description': 'All counseling sessions with student, counselor, and concern type.', 'icon': 'bi-chat-heart'},
            {'key': 'referrals', 'name': 'Referral Report', 'description': 'All referrals with priority, status, and timeline.', 'icon': 'bi-send-exclamation'},
            {'key': 'inventory', 'name': 'Inventory Report', 'description': 'Stock levels, categories, and reorder thresholds.', 'icon': 'bi-box-seam'},
            {'key': 'borrowing', 'name': 'Borrowing Report', 'description': 'All borrowing records with return status.', 'icon': 'bi-arrow-left-right'},
            {'key': 'user-activity', 'name': 'User Activity Logs', 'description': 'Audit log of all user actions across the system.', 'icon': 'bi-activity'},
        ],
    })


@login_required
@role_required('Administrator', 'Guidance Staff')
def student_report(request):
    """Student Record Report — surfaces the Student Record Inventory summary
    (record counts, guidance coverage, case and referral totals, plus the
    year level / course / gender / concern breakdowns) instead of a plain
    student directory that duplicates the Students page."""
    data = get_student_inventory_data()

    if request.GET.get('format') == 'csv':
        rows = [['Summary', label, data['kpis'].get(key, 0)]
                for key, label in _STUDENT_REPORT_KPIS]
        for key, section in _STUDENT_REPORT_BREAKDOWNS:
            rows.extend([section, row['label'], row['value']] for row in data.get(key, []))
        return _csv_response(f'student_record_report_{timezone.now():%Y%m%d}.csv',
                             ['Section', 'Label', 'Value'], rows)

    return render(request, 'reports/student_report.html', {
        'inventory_data': data, 'section': 'reports',
    })


@login_required
@role_required('Administrator', 'Guidance Staff')
def counseling_report(request):
    date_from, date_to = _date_range_from_request(request)
    qs = CounselingSession.objects.filter(session_date__range=(date_from, date_to)).select_related('student', 'counselor').order_by('-session_date')

    if request.GET.get('format') == 'csv':
        header = ['Date', 'Student #', 'Student Name', 'Counselor', 'Concern Type', 'Status', 'Follow-up']
        rows = [[c.session_date, c.student.student_number, c.student.full_name, c.counselor.full_name,
                 c.get_concern_type_display(), c.get_status_display(), c.follow_up_date] for c in qs]
        return _csv_response(f'counseling_report_{timezone.now():%Y%m%d}.csv', header, rows)

    return render(request, 'reports/counseling_report.html', {
        'sessions': qs, 'date_from': date_from, 'date_to': date_to, 'section': 'reports',
    })


@login_required
@role_required('Administrator', 'Guidance Staff')
def referral_report(request):
    date_from, date_to = _date_range_from_request(request)
    qs = Referral.objects.filter(referred_at__date__range=(date_from, date_to)).select_related('student', 'referred_by', 'assigned_counselor').order_by('-referred_at')

    if request.GET.get('format') == 'csv':
        header = ['Referral #', 'Referred At', 'Student #', 'Student Name', 'Referred By', 'Assigned To',
                  'Type', 'Priority', 'Status', 'Reason']
        rows = [[r.pk, r.referred_at, r.student.student_number, r.student.full_name,
                 r.referred_by.full_name, r.assigned_counselor.full_name if r.assigned_counselor_id else '—',
                 r.get_referral_type_display(), r.get_priority_display(), r.get_status_display(), r.reason] for r in qs]
        return _csv_response(f'referral_report_{timezone.now():%Y%m%d}.csv', header, rows)

    return render(request, 'reports/referral_report.html', {
        'referrals': qs, 'date_from': date_from, 'date_to': date_to, 'section': 'reports',
    })


@login_required
@role_required('Administrator', 'Guidance Staff')
def inventory_report(request):
    items = list(InventoryItem.objects.all().order_by('name'))

    if request.GET.get('format') == 'csv':
        header = ['Item Code', 'Name', 'Category', 'Quantity', 'Unit', 'Reorder Level', 'Stock Status']
        rows = [[i.item_code, i.name, i.get_category_display(), i.quantity, i.unit,
                 i.reorder_level, i.stock_status_display] for i in items]
        return _csv_response(f'inventory_report_{timezone.now():%Y%m%d}.csv', header, rows)

    return render(request, 'reports/inventory_report.html', {
        'items': items, 'section': 'reports',
    })


@login_required
@role_required('Administrator', 'Guidance Staff')
def borrowing_report(request):
    date_from, date_to = _date_range_from_request(request)
    qs = BorrowedItem.objects.filter(borrow_date__range=(date_from, date_to)).select_related('item').order_by('-borrow_date')

    if request.GET.get('format') == 'csv':
        header = ['Borrower', 'Department', 'Item Code', 'Item Name', 'Quantity',
                  'Borrow Date', 'Expected Return', 'Actual Return', 'Status']
        rows = [[b.borrower_name, b.department, b.item.item_code, b.item.name, b.quantity,
                 b.borrow_date, b.expected_return_date, b.actual_return_date, b.get_status_display()] for b in qs]
        return _csv_response(f'borrowing_report_{timezone.now():%Y%m%d}.csv', header, rows)

    return render(request, 'reports/borrowing_report.html', {
        'borrowed': qs, 'date_from': date_from, 'date_to': date_to, 'section': 'reports',
    })


@login_required
@role_required('Administrator')
def user_activity_report(request):
    date_from, date_to = _date_range_from_request(request)
    qs = SystemLog.objects.filter(timestamp__date__range=(date_from, date_to)).select_related('user').order_by('-timestamp')

    if request.GET.get('format') == 'csv':
        header = ['Timestamp', 'User', 'Action', 'Entity', 'Entity ID', 'Description', 'IP']
        rows = [[l.timestamp, l.user.full_name if l.user_id else '—', l.get_action_display(),
                 l.entity, l.entity_id, l.description, l.ip_address] for l in qs]
        return _csv_response(f'user_activity_report_{timezone.now():%Y%m%d}.csv', header, rows)

    return render(request, 'reports/user_activity_report.html', {
        'logs': qs[:500], 'date_from': date_from, 'date_to': date_to, 'section': 'reports',
        'total_count': qs.count(),
    })

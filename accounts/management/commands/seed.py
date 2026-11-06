"""
Management command to seed the database with sample data.

Usage:
    python manage.py seed          # Create all sample data
    python manage.py seed --clear  # Clear all data and re-seed

Creates sample data for:
- Users (Administrator, Guidance Staff, Counselors)
- Students with guardians
- Counseling sessions with notes
- Referrals with updates
- Inventory items with stock movements
- Borrowed items
- Notifications
- School settings
"""
import random
from datetime import timedelta, date

from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import User, Role, SystemLog
from students.models import Student, Guardian, ActivityTimeline
from counseling.models import CounselingSession, CounselorNote
from referrals.models import Referral, ReferralUpdate
from inventory.models import InventoryItem, StockMovement, BorrowedItem
from notifications.models import Notification
from configurations.models import SchoolSettings


class Command(BaseCommand):
    help = 'Seed the database with sample data for testing and demonstration'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear all existing data before seeding',
        )

    def handle(self, *args, **options):
        if options['clear']:
            self.stdout.write('Clearing existing data...')
            self.clear_data()

        self.stdout.write('Seeding database with sample data...')

        # Create data in order of dependencies
        roles = self.create_roles()
        admin, staff, counselor1, counselor2 = self.create_users(roles)
        students = self.create_students(admin)
        self.create_guardians(students)
        self.create_counseling_sessions(students, counselor1, counselor2, admin)
        self.create_referrals(students, staff, counselor1, counselor2, admin)
        inventory_items = self.create_inventory_items(admin)
        self.create_stock_movements(inventory_items, admin)
        self.create_borrowed_items(inventory_items, staff, admin)
        self.create_notifications(admin, staff, counselor1)
        self.create_school_settings(admin)
        self.create_activity_timeline(students, admin, counselor1)
        self.create_system_logs(admin, staff, counselor1)

        self.stdout.write(self.style.SUCCESS(
            '\n✓ Database seeded successfully!\n'
            '\nSample Login Credentials:'
            '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
            '\n  Administrator:  admin / admin123'
            '\n  Guidance Staff: staff / staff123'
            '\n  Counselor 1:    counselor1 / counselor123'
            '\n  Counselor 2:    counselor2 / counselor123'
            '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
        ))

    def clear_data(self):
        """Clear all data from the database."""
        Notification.objects.all().delete()
        BorrowedItem.objects.all().delete()
        StockMovement.objects.all().delete()
        InventoryItem.objects.all().delete()
        ReferralUpdate.objects.all().delete()
        Referral.objects.all().delete()
        CounselorNote.objects.all().delete()
        CounselingSession.objects.all().delete()
        ActivityTimeline.objects.all().delete()
        Guardian.objects.all().delete()
        Student.objects.all().delete()
        SystemLog.objects.all().delete()
        User.objects.filter(is_superuser=False).delete()
        SchoolSettings.objects.all().delete()
        self.stdout.write('  Data cleared.')

    def create_roles(self):
        """Create the three default roles."""
        roles = {}
        for name, desc in [
            ('Administrator', 'Full system access — manages users, settings, and database.'),
            ('Guidance Staff', 'Manages students, counseling, referrals, and inventory.'),
            ('Counselor', 'Manages student profiles, counseling records, and referrals.'),
        ]:
            role, _ = Role.objects.get_or_create(name=name, defaults={'description': desc})
            roles[name] = role
        self.stdout.write('  ✓ Roles created')
        return roles

    def create_users(self, roles):
        """Create sample users with different roles."""
        now = timezone.now()

        # Administrator
        admin, created = User.objects.get_or_create(
            username='admin',
            defaults={
                'email': 'admin@school.edu',
                'first_name': 'Maria',
                'middle_name': 'Santos',
                'last_name': 'Garcia',
                'role': roles['Administrator'],
                'status': User.STATUS_ACTIVE,
                'employee_id': 'EMP-00001',
                'contact_number': '09171234567',
                'is_staff': True,
                'is_superuser': True,
                'approved_at': now,
            }
        )
        if created:
            admin.set_password('admin123')
            admin.save()
            admin.approved_by = admin
            admin.save()

        # Guidance Staff
        staff, created = User.objects.get_or_create(
            username='staff',
            defaults={
                'email': 'staff@school.edu',
                'first_name': 'Juan',
                'middle_name': 'Cruz',
                'last_name': 'Dela Cruz',
                'role': roles['Guidance Staff'],
                'status': User.STATUS_ACTIVE,
                'employee_id': 'EMP-00002',
                'contact_number': '09181234567',
                'approved_by': admin,
                'approved_at': now,
            }
        )
        if created:
            staff.set_password('staff123')
            staff.save()

        # Counselor 1
        counselor1, created = User.objects.get_or_create(
            username='counselor1',
            defaults={
                'email': 'counselor1@school.edu',
                'first_name': 'Ana',
                'middle_name': 'Reyes',
                'last_name': 'Santos',
                'role': roles['Counselor'],
                'status': User.STATUS_ACTIVE,
                'employee_id': 'EMP-00003',
                'contact_number': '09191234567',
                'approved_by': admin,
                'approved_at': now,
            }
        )
        if created:
            counselor1.set_password('counselor123')
            counselor1.save()

        # Counselor 2
        counselor2, created = User.objects.get_or_create(
            username='counselor2',
            defaults={
                'email': 'counselor2@school.edu',
                'first_name': 'Pedro',
                'middle_name': 'Luna',
                'last_name': 'Reyes',
                'role': roles['Counselor'],
                'status': User.STATUS_ACTIVE,
                'employee_id': 'EMP-00004',
                'contact_number': '09201234567',
                'approved_by': admin,
                'approved_at': now,
            }
        )
        if created:
            counselor2.set_password('counselor123')
            counselor2.save()

        # Pending user (for approval demo)
        pending, created = User.objects.get_or_create(
            username='pending_user',
            defaults={
                'email': 'pending@school.edu',
                'first_name': 'Test',
                'last_name': 'Pending',
                'role': roles['Guidance Staff'],
                'status': User.STATUS_PENDING,
                'employee_id': 'EMP-00005',
            }
        )
        if created:
            pending.set_password('pending123')
            pending.save()

        self.stdout.write('  ✓ Users created')
        return admin, staff, counselor1, counselor2

    def create_students(self, created_by):
        """Create sample students."""
        student_data = [
            ('2025-0001', 'Andrei', 'Santos', 'Mendoza', 'male', '1st Year', 'BSIT-1A', '2007-03-15', '123 Main St, Manila', '09171111111'),
            ('2025-0002', 'Bianca', 'Cruz', 'Reyes', 'female', '1st Year', 'BSED-1A', '2007-07-22', '456 Oak Ave, Quezon City', '09172222222'),
            ('2025-0003', 'Carlos', 'Rivera', 'Santos', 'male', '2nd Year', 'BSBA-2A', '2006-11-08', '789 Pine Rd, Makati', '09173333333'),
            ('2025-0004', 'Diana', 'Lopez', 'Garcia', 'female', '2nd Year', 'BSIT-2B', '2006-05-30', '321 Elm St, Pasig', '09174444444'),
            ('2025-0005', 'Eduardo', 'Tan', 'Cruz', 'male', '3rd Year', 'BSCS-3A', '2005-09-12', '654 Maple Dr, Taguig', '09175555555'),
            ('2025-0006', 'Fiona', 'Sy', 'Lim', 'female', '3rd Year', 'BSED-3A', '2005-01-25', '987 Cedar Ln, Mandaluyong', '09176666666'),
            ('2025-0007', 'Gabriel', 'Cruz', 'Villanueva', 'male', '4th Year', 'BSIT-4A', '2004-04-18', '147 Birch St, Paranaque', '09177777777'),
            ('2025-0008', 'Hannah', 'Santos', 'Aquino', 'female', '4th Year', 'BSBA-4B', '2004-08-03', '258 Walnut Ave, Las Pinas', '09178888888'),
            ('2025-0009', 'Isabel', 'Reyes', 'Torres', 'female', '1st Year', 'BSN-1A', '2007-12-10', '369 Spruce Rd, Muntinlupa', '09179999999'),
            ('2025-0010', 'James', 'Garcia', 'Santos', 'male', '2nd Year', 'BSCS-2A', '2006-06-28', '471 Oak Blvd, Caloocan', '09180000000'),
            ('2025-0011', 'Kim', 'Torres', 'Cruz', 'female', '3rd Year', 'BSN-3A', '2005-02-14', '582 Pine Ave, Valenzuela', '09181111111'),
            ('2025-0012', 'Luis', 'Mendoza', 'Reyes', 'male', '4th Year', 'BSED-4A', '2004-10-05', '693 Elm Dr, Malabon', '09182222222'),
            ('2025-0013', 'Mia', 'Aquino', 'Santos', 'female', '1st Year', 'BSBA-1B', '2007-04-20', '714 Cedar St, Navotas', '09183333333'),
            ('2025-0014', 'Nathan', 'Villanueva', 'Cruz', 'male', '2nd Year', 'BSIT-2A', '2006-11-15', '825 Maple Ln, Marikina', '09184444444'),
            ('2025-0015', 'Olivia', 'Lim', 'Tan', 'female', '3rd Year', 'BSN-3B', '2005-03-08', '936 Walnut Rd, San Juan', '09185555555'),
        ]

        students = []
        for data in student_data:
            student, created = Student.objects.get_or_create(
                student_number=data[0],
                defaults={
                    'first_name': data[1],
                    'middle_name': data[2],
                    'last_name': data[3],
                    'gender': data[4],
                    'grade_level': data[5],
                    'section': data[6],
                    'birthdate': date.fromisoformat(data[7]),
                    'address': data[8],
                    'contact_number': data[9],
                    'school_year': '2025-2026',
                    'status': Student.STATUS_ACTIVE,
                    'created_by': created_by,
                }
            )
            students.append(student)

        # Add some inactive/graduated students
        Student.objects.get_or_create(
            student_number='2024-0001',
            defaults={
                'first_name': 'Graduated',
                'last_name': 'Student',
                'gender': 'male',
                'grade_level': '4th Year',
                'section': 'BSCS-4A',
                'school_year': '2024-2025',
                'status': Student.STATUS_GRADUATED,
                'created_by': created_by,
            }
        )

        self.stdout.write(f'  ✓ {len(students)} students created')
        return students

    def create_guardians(self, students):
        """Create guardians for students."""
        guardian_data = [
            ('Maria Mendoza', 'mother', '09171111112', 'maria.mendoza@email.com'),
            ('Jose Reyes', 'father', '09172222223', 'jose.reyes@email.com'),
            ('Rosa Santos', 'mother', '09173333334', 'rosa.santos@email.com'),
            ('Pedro Garcia', 'father', '09174444445', 'pedro.garcia@email.com'),
            ('Linda Cruz', 'mother', '09175555556', 'linda.cruz@email.com'),
        ]

        for i, student in enumerate(students[:5]):
            Guardian.objects.get_or_create(
                student=student,
                full_name=guardian_data[i][0],
                defaults={
                    'relationship': guardian_data[i][1],
                    'contact_number': guardian_data[i][2],
                    'email': guardian_data[i][3],
                    'address': student.address,
                    'is_primary': True,
                }
            )

        self.stdout.write('  ✓ Guardians created')

    def create_counseling_sessions(self, students, counselor1, counselor2, created_by):
        """Create sample counseling sessions."""
        today = timezone.now().date()

        sessions_data = [
            (students[0], counselor1, today - timedelta(days=30), 'academic', 'closed', 'Student struggling with math.', 'Recommended tutoring sessions.', today - timedelta(days=15)),
            (students[1], counselor1, today - timedelta(days=25), 'personal', 'closed', 'Family issues affecting attendance.', 'Referred to family counselor.', None),
            (students[2], counselor2, today - timedelta(days=20), 'behavioral', 'ongoing', 'Behavioral issues in class.', 'Implementing behavior modification plan.', today + timedelta(days=5)),
            (students[3], counselor1, today - timedelta(days=15), 'career', 'open', 'Career guidance for senior high.', 'Discussed STEM track options.', None),
            (students[4], counselor2, today - timedelta(days=10), 'social', 'ongoing', 'Peer relationship difficulties.', 'Group counseling sessions recommended.', today + timedelta(days=7)),
            (students[5], counselor1, today - timedelta(days=7), 'mental_health', 'open', 'Anxiety symptoms reported.', 'Scheduled follow-up assessment.', today + timedelta(days=3)),
            (students[6], counselor2, today - timedelta(days=5), 'academic', 'open', 'Declining grades in science.', 'Created academic improvement plan.', None),
            (students[7], counselor1, today - timedelta(days=3), 'follow_up', 'open', 'Follow-up on previous session.', 'Progress noted, continuing support.', today + timedelta(days=14)),
        ]

        for data in sessions_data:
            session, created = CounselingSession.objects.get_or_create(
                student=data[0],
                counselor=data[1],
                session_date=data[2],
                defaults={
                    'concern_type': data[3],
                    'status': data[4],
                    'summary': data[5],
                    'notes': data[6],
                    'follow_up_date': data[7],
                    'created_by': created_by,
                    'closed_at': timezone.now() if data[4] == 'closed' else None,
                }
            )

            # Add counselor notes to some sessions
            if created and data[4] in ('ongoing', 'closed'):
                CounselorNote.objects.create(
                    session=session,
                    author=data[1],
                    note=f'Initial assessment completed. {data[6]}',
                    is_private=False,
                )

        self.stdout.write('  ✓ Counseling sessions created')

    def create_referrals(self, students, staff, counselor1, counselor2, created_by):
        """Create sample referrals."""
        referrals_data = [
            (students[0], staff, counselor1, 'counseling', 'high', 'Academic performance declining significantly.', 'Student needs intensive academic support.', 'ongoing'),
            (students[2], staff, counselor2, 'behavioral', 'urgent', 'Repeated classroom disruptions.', 'Behavioral intervention required immediately.', 'ongoing'),
            (students[4], staff, counselor1, 'psychological', 'normal', 'Signs of social anxiety.', 'Recommend psychological evaluation.', 'pending'),
            (students[6], staff, counselor2, 'academic', 'high', 'Failing multiple subjects.', 'Academic intervention program needed.', 'completed'),
            (students[8], staff, counselor1, 'career', 'low', 'Career path indecision.', 'Career guidance counseling requested.', 'pending'),
            (students[10], staff, counselor2, 'medical', 'normal', 'Vision problems reported.', 'Medical referral for eye examination.', 'completed'),
        ]

        for data in referrals_data:
            referral, created = Referral.objects.get_or_create(
                student=data[0],
                referred_by=data[1],
                defaults={
                    'assigned_counselor': data[2],
                    'referral_type': data[3],
                    'priority': data[4],
                    'reason': data[5],
                    'description': data[6],
                    'status': data[7],
                    'completed_at': timezone.now() if data[7] == 'completed' else None,
                }
            )

            # Add updates for ongoing/completed referrals
            if created and data[7] in ('ongoing', 'completed'):
                ReferralUpdate.objects.create(
                    referral=referral,
                    author=data[2],
                    previous_status='pending',
                    new_status='ongoing' if data[7] == 'ongoing' else 'completed',
                    note='Referral reviewed and accepted.' if data[7] == 'ongoing' else 'Referral completed successfully.',
                )
                if data[7] == 'completed':
                    ReferralUpdate.objects.create(
                        referral=referral,
                        author=data[2],
                        previous_status='ongoing',
                        new_status='completed',
                        note='All objectives met. Case closed.',
                    )

        self.stdout.write('  ✓ Referrals created')

    def create_inventory_items(self, created_by):
        """Create sample inventory items."""
        items_data = [
            ('ITM-00001', 'Bond Paper A4', 'office_supplies', 50, 'ream', 10, 'High-quality A4 bond paper'),
            ('ITM-00002', 'Ballpoint Pen (Blue)', 'office_supplies', 100, 'piece', 20, 'Standard blue ballpoint pens'),
            ('ITM-00003', 'Printer Ink (Black)', 'office_supplies', 3, 'piece', 5, 'HP compatible black ink cartridge'),
            ('ITM-00004', 'Stapler', 'equipment', 15, 'piece', 3, 'Heavy-duty desktop stapler'),
            ('ITM-00005', 'Staple Wire', 'office_supplies', 20, 'box', 5, 'Standard staple wires (1000/box)'),
            ('ITM-00006', 'Folder (Long)', 'office_supplies', 200, 'piece', 50, 'Long brown folder'),
            ('ITM-00007', 'Whiteboard Marker', 'office_supplies', 2, 'pack', 5, 'Assorted color whiteboard markers (4/pack)'),
            ('ITM-00008', 'Scissors', 'equipment', 8, 'piece', 3, 'Standard office scissors'),
            ('ITM-00009', 'Tape Dispenser', 'equipment', 5, 'piece', 2, 'Desktop tape dispenser'),
            ('ITM-00010', 'Sticky Notes', 'office_supplies', 0, 'pack', 10, '3x3 inch sticky notes (100/pack)'),
            ('ITM-00011', 'Printer Paper Legal', 'office_supplies', 25, 'ream', 10, 'Legal size printer paper'),
            ('ITM-00012', 'Envelopes (Long)', 'forms', 150, 'piece', 30, 'Long brown envelopes'),
            ('ITM-00013', 'Clearbook', 'forms', 40, 'piece', 10, 'Clear presentation book (20 pages)'),
            ('ITM-00014', 'Computer Chair', 'furniture', 5, 'piece', 2, 'Adjustable office chair'),
            ('ITM-00015', 'Filing Cabinet', 'furniture', 3, 'piece', 1, '4-drawer metal filing cabinet'),
        ]

        items = []
        for data in items_data:
            item, created = InventoryItem.objects.get_or_create(
                item_code=data[0],
                defaults={
                    'name': data[1],
                    'category': data[2],
                    'quantity': data[3],
                    'unit': data[4],
                    'reorder_level': data[5],
                    'description': data[6],
                    'created_by': created_by,
                }
            )
            items.append(item)

        self.stdout.write(f'  ✓ {len(items)} inventory items created')
        return items

    def create_stock_movements(self, items, performed_by):
        """Create stock movement history."""
        for item in items[:5]:
            # Initial stock in
            StockMovement.objects.get_or_create(
                item=item,
                movement_type='in',
                defaults={
                    'quantity': item.quantity + 20,
                    'balance_after': item.quantity + 20,
                    'note': 'Initial stock',
                    'performed_by': performed_by,
                }
            )
            # Some stock out
            if item.quantity > 0:
                StockMovement.objects.get_or_create(
                    item=item,
                    movement_type='out',
                    defaults={
                        'quantity': 20,
                        'balance_after': item.quantity,
                        'note': 'Distributed to staff',
                        'performed_by': performed_by,
                    }
                )

        self.stdout.write('  ✓ Stock movements created')

    def create_borrowed_items(self, items, staff, recorded_by):
        """Create sample borrowed items."""
        today = timezone.now().date()

        borrowed_data = [
            ('Juan Dela Cruz', 'Guidance Office', items[13], 1, today - timedelta(days=10), today + timedelta(days=5)),
            ('Ana Santos', 'Counseling', items[7], 1, today - timedelta(days=15), today - timedelta(days=1)),
            ('Pedro Reyes', 'Admin', items[3], 1, today - timedelta(days=5), today + timedelta(days=10)),
        ]

        for data in borrowed_data:
            BorrowedItem.objects.get_or_create(
                borrower_name=data[0],
                item=data[2],
                borrow_date=data[4],
                defaults={
                    'department': data[1],
                    'quantity': data[3],
                    'expected_return_date': data[5],
                    'status': BorrowedItem.STATUS_BORROWED,
                    'recorded_by': recorded_by,
                    'notes': 'Borrowed for office use',
                }
            )

        # Create one returned item
        BorrowedItem.objects.get_or_create(
            borrower_name='Maria Garcia',
            item=items[0],
            defaults={
                'department': 'Admin',
                'quantity': 5,
                'borrow_date': today - timedelta(days=30),
                'expected_return_date': today - timedelta(days=15),
                'actual_return_date': today - timedelta(days=14),
                'status': BorrowedItem.STATUS_RETURNED,
                'recorded_by': recorded_by,
            }
        )

        self.stdout.write('  ✓ Borrowed items created')

    def create_notifications(self, admin, staff, counselor):
        """Create sample notifications."""
        notifications_data = [
            (admin, 'low_stock', 'high', 'Low stock alert: Printer Ink (Black)', '"Printer Ink (Black)" is below reorder level (3 piece left, reorder at 5).', '/inventory/3/'),
            (admin, 'low_stock', 'high', 'Out of stock: Sticky Notes', '"Sticky Notes" is now OUT OF STOCK. Please restock immediately.', '/inventory/10/'),
            (counselor, 'new_referral', 'high', 'New referral assigned: Eduardo Tan', 'You have been assigned a new Counseling referral. Priority: High.', '/referrals/1/'),
            (counselor, 'counseling_follow_up', 'normal', 'Follow-up reminder: Isabel Torres', 'Follow-up session scheduled for Isabel Torres.', '/counseling/5/'),
            (staff, 'system', 'low', 'System maintenance scheduled', 'System maintenance scheduled for this weekend.', ''),
        ]

        for data in notifications_data:
            Notification.objects.get_or_create(
                user=data[0],
                title=data[3],
                defaults={
                    'category': data[1],
                    'priority': data[2],
                    'message': data[4],
                    'link': data[5],
                    'is_read': False,
                }
            )

        self.stdout.write('  ✓ Notifications created')

    def create_school_settings(self, updated_by):
        """Create school settings."""
        settings, created = SchoolSettings.objects.get_or_create(
            pk=1,
            defaults={
                'school_name': 'Metro Manila National High School',
                'school_address': '123 Rizal Avenue, Quezon City, Metro Manila',
                'school_year': '2025-2026',
                'contact_email': 'info@mmnhs.edu.ph',
                'contact_phone': '(02) 8123-4567',
                'system_title': 'Guidance Office Records Inventory Management System',
                'footer_text': 'Empowering students through guidance and support',
                'default_theme': 'light',
                'updated_by': updated_by,
            }
        )
        self.stdout.write('  ✓ School settings created')

    def create_activity_timeline(self, students, admin, counselor):
        """Create activity timeline entries for students."""
        activities = [
            (students[0], 'profile', 'Student record created', 'Initial student registration'),
            (students[0], 'counseling', 'Counseling session: Academic', 'Session on math performance'),
            (students[0], 'referral', 'New referral: Counseling', 'Academic support referral created'),
            (students[1], 'profile', 'Student record created', 'Initial student registration'),
            (students[2], 'counseling', 'Counseling session: Behavioral', 'Behavioral intervention session'),
            (students[2], 'referral', 'New referral: Behavioral', 'Urgent behavioral referral'),
        ]

        for data in activities:
            ActivityTimeline.objects.get_or_create(
                student=data[0],
                title=data[2],
                defaults={
                    'activity_type': data[1],
                    'description': data[3],
                    'performed_by': admin if data[1] == 'profile' else counselor,
                }
            )

        self.stdout.write('  ✓ Activity timeline created')

    def create_system_logs(self, admin, staff, counselor):
        """Create sample system logs."""
        logs_data = [
            (admin, 'create', 'Student', 'Created student record: Mendoza, Andrei'),
            (admin, 'create', 'Student', 'Created student record: Reyes, Bianca'),
            (staff, 'create', 'Referral', 'Created referral #1 for Mendoza, Andrei'),
            (counselor, 'create', 'CounselingSession', 'Created counseling session for Mendoza, Andrei'),
            (admin, 'update', 'SchoolSettings', 'Updated school settings'),
            (counselor, 'update', 'CounselingSession', 'Closed counseling session #1'),
            (staff, 'create', 'InventoryItem', 'Added inventory item: Bond Paper A4'),
            (admin, 'backup', 'Database', 'Manual backup created'),
        ]

        for data in logs_data:
            SystemLog.objects.create(
                user=data[0],
                action=data[1],
                entity=data[2],
                description=data[3],
            )

        self.stdout.write('  ✓ System logs created')

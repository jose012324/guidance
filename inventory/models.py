"""
Inventory app — office inventory + borrowed items management.

Models:
    * InventoryItem  — stock items (Phase 18-19)
    * BorrowedItem   — borrowing workflow (Phase 21)
    * StockMovement  — stock-in / stock-out audit trail (Phase 20)

Categories: Office Supplies, Furniture, Equipment, Forms & Documents.
Stock statuses: Available, Low Stock, Out of Stock.
Borrowing statuses: Borrowed, Returned, Overdue.
"""
from django.db import models
from django.utils import timezone

from accounts.models import User


class InventoryItem(models.Model):
    """A single inventory item with quantity, reorder level, and computed status."""

    CATEGORY_OFFICE_SUPPLIES = 'office_supplies'
    CATEGORY_FURNITURE = 'furniture'
    CATEGORY_EQUIPMENT = 'equipment'
    CATEGORY_FORMS = 'forms'
    CATEGORY_OTHER = 'other'
    CATEGORY_CHOICES = [
        (CATEGORY_OFFICE_SUPPLIES, 'Office Supplies'),
        (CATEGORY_FURNITURE, 'Furniture'),
        (CATEGORY_EQUIPMENT, 'Equipment'),
        (CATEGORY_FORMS, 'Forms & Documents'),
        (CATEGORY_OTHER, 'Other'),
    ]

    UNIT_CHOICES = [
        ('piece', 'Piece'), ('box', 'Box'), ('pack', 'Pack'),
        ('ream', 'Ream'), ('set', 'Set'), ('unit', 'Unit'), ('bundle', 'Bundle'),
    ]

    # Identity
    item_code = models.CharField(max_length=30, unique=True, help_text='Auto-generated if blank')
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default=CATEGORY_OFFICE_SUPPLIES)

    # Quantities
    quantity = models.PositiveIntegerField(default=0)
    unit = models.CharField(max_length=15, choices=UNIT_CHOICES, default='piece')
    reorder_level = models.PositiveIntegerField(default=5, help_text='Threshold for low-stock alert')

    # Audit
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='inventory_items_created'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        indexes = [
            models.Index(fields=['category']),
            models.Index(fields=['quantity']),
        ]

    def __str__(self):
        return f"{self.item_code} — {self.name}"

    # Computed status (Phase 18 — Available / Low Stock / Out of Stock)
    @property
    def stock_status(self):
        if self.quantity == 0:
            return 'out_of_stock'
        if self.quantity <= self.reorder_level:
            return 'low_stock'
        return 'available'

    @property
    def stock_status_display(self):
        return {
            'available': 'Available',
            'low_stock': 'Low Stock',
            'out_of_stock': 'Out of Stock',
        }.get(self.stock_status, 'Available')


class StockMovement(models.Model):
    """Audit trail for inventory stock changes (Phase 20 — Stock Monitoring Center)."""
    MOVEMENT_IN = 'in'
    MOVEMENT_OUT = 'out'
    MOVEMENT_ADJUST = 'adjust'
    MOVEMENT_CHOICES = [
        (MOVEMENT_IN, 'Stock In'),
        (MOVEMENT_OUT, 'Stock Out'),
        (MOVEMENT_ADJUST, 'Adjustment'),
    ]
    item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name='movements')
    movement_type = models.CharField(max_length=10, choices=MOVEMENT_CHOICES)
    quantity = models.IntegerField()
    balance_after = models.PositiveIntegerField(default=0)
    note = models.CharField(max_length=255, blank=True)
    performed_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='stock_movements'
    )
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.get_movement_type_display()} {self.quantity} — {self.item}"


class BorrowedItem(models.Model):
    """
    Borrowing workflow (Phase 21).
    Tracks who borrowed what, when, and whether/when it was returned.
    """

    STATUS_BORROWED = 'borrowed'
    STATUS_RETURNED = 'returned'
    STATUS_OVERDUE = 'overdue'
    STATUS_CHOICES = [
        (STATUS_BORROWED, 'Borrowed'),
        (STATUS_RETURNED, 'Returned'),
        (STATUS_OVERDUE, 'Overdue'),
    ]

    # Borrower information
    borrower_name = models.CharField(max_length=150, help_text='Staff member who borrowed')
    department = models.CharField(max_length=100, blank=True)
    borrower_user = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='borrowed_items'
    )

    # Item information
    item = models.ForeignKey(InventoryItem, on_delete=models.PROTECT, related_name='borrowed_records')
    quantity = models.PositiveIntegerField(default=1)

    # Dates
    borrow_date = models.DateField(default=timezone.now)
    expected_return_date = models.DateField(null=True, blank=True)
    actual_return_date = models.DateField(null=True, blank=True)

    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default=STATUS_BORROWED)
    notes = models.TextField(blank=True)

    # Audit
    recorded_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='borrowed_items_recorded'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-borrow_date']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['borrow_date']),
        ]

    def __str__(self):
        return f"{self.quantity} × {self.item} — {self.borrower_name} ({self.get_status_display()})"

    @classmethod
    def mark_overdue(cls):
        """Bulk-update all overdue borrowings. Called periodically via management command."""
        today = timezone.now().date()
        overdue = cls.objects.filter(
            status=cls.STATUS_BORROWED,
            expected_return_date__lt=today,
        )
        return overdue.update(status=cls.STATUS_OVERDUE)

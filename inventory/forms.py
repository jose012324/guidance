"""
Inventory app forms (Phase 18-21).
"""
from django import forms

from .models import InventoryItem, BorrowedItem, StockMovement


class InventoryItemForm(forms.ModelForm):
    """Add / edit inventory item (Phase 19)."""
    class Meta:
        model = InventoryItem
        fields = ('item_code', 'name', 'description', 'category',
                  'quantity', 'unit', 'reorder_level')
        widgets = {
            'item_code': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Auto-generated if blank'}),
            'name': forms.TextInput(attrs={'class': 'form-control'}),
            'description': forms.Textarea(attrs={'class': 'form-control', 'rows': 2}),
            'category': forms.Select(attrs={'class': 'form-select'}),
            'quantity': forms.NumberInput(attrs={'class': 'form-control', 'min': 0}),
            'unit': forms.Select(attrs={'class': 'form-select'}),
            'reorder_level': forms.NumberInput(attrs={'class': 'form-control', 'min': 0}),
        }

    def save(self, commit=True):
        item = super().save(commit=False)
        if not item.item_code:
            # Auto-generate item code
            prefix = 'ITM'
            last = InventoryItem.objects.order_by('-id').first()
            next_num = (last.id + 1) if last else 1
            item.item_code = f"{prefix}-{next_num:05d}"
        if commit:
            item.save()
        return item


class BorrowedItemForm(forms.ModelForm):
    """Borrowing workflow form (Phase 21)."""
    class Meta:
        model = BorrowedItem
        fields = ('borrower_name', 'department', 'borrower_user', 'item',
                  'quantity', 'borrow_date', 'expected_return_date', 'notes')
        widgets = {
            'borrower_name': forms.TextInput(attrs={'class': 'form-control'}),
            'department': forms.TextInput(attrs={'class': 'form-control'}),
            'borrower_user': forms.Select(attrs={'class': 'form-select'}),
            'item': forms.Select(attrs={'class': 'form-select'}),
            'quantity': forms.NumberInput(attrs={'class': 'form-control', 'min': 1}),
            'borrow_date': forms.DateInput(attrs={'class': 'form-control datepicker'}),
            'expected_return_date': forms.DateInput(attrs={'class': 'form-control datepicker'}),
            'notes': forms.Textarea(attrs={'class': 'form-control', 'rows': 2}),
        }

    def clean(self):
        cleaned = super().clean()
        item = cleaned.get('item')
        qty = cleaned.get('quantity')
        if item and qty:
            available = item.quantity - BorrowedItem.objects.filter(
                item=item, status__in=[BorrowedItem.STATUS_BORROWED, BorrowedItem.STATUS_OVERDUE]
            ).count()
            if qty > available:
                raise forms.ValidationError(
                    f'Only {available} units of "{item.name}" are available for borrowing.'
                )
        return cleaned


class ReturnBorrowedItemForm(forms.ModelForm):
    """Mark a borrowed item as returned."""
    class Meta:
        model = BorrowedItem
        fields = ('actual_return_date', 'notes')
        widgets = {
            'actual_return_date': forms.DateInput(attrs={'class': 'form-control datepicker'}),
            'notes': forms.Textarea(attrs={'class': 'form-control', 'rows': 2}),
        }


class StockAdjustmentForm(forms.ModelForm):
    """Stock-in / stock-out / adjustment form (Phase 20)."""
    class Meta:
        model = StockMovement
        fields = ('movement_type', 'quantity', 'note')
        widgets = {
            'movement_type': forms.Select(attrs={'class': 'form-select'}),
            'quantity': forms.NumberInput(attrs={'class': 'form-control'}),
            'note': forms.TextInput(attrs={'class': 'form-control'}),
        }


class InventoryFilterForm(forms.Form):
    search = forms.CharField(required=False, widget=forms.TextInput(attrs={
        'class': 'form-control', 'placeholder': 'Search name or item code...'
    }))
    category = forms.ChoiceField(required=False, choices=[('', 'All Categories')] + InventoryItem.CATEGORY_CHOICES,
                                 widget=forms.Select(attrs={'class': 'form-select'}))
    stock_status = forms.ChoiceField(required=False, choices=[
        ('', 'All Stock Statuses'),
        ('available', 'Available'),
        ('low_stock', 'Low Stock'),
        ('out_of_stock', 'Out of Stock'),
    ], widget=forms.Select(attrs={'class': 'form-select'}))


class BorrowedFilterForm(forms.Form):
    search = forms.CharField(required=False, widget=forms.TextInput(attrs={
        'class': 'form-control', 'placeholder': 'Search borrower or item...'
    }))
    status = forms.ChoiceField(required=False, choices=[('', 'All Statuses')] + BorrowedItem.STATUS_CHOICES,
                               widget=forms.Select(attrs={'class': 'form-select'}))

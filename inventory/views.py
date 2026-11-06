"""
Inventory app views (Phase 18-21).

Endpoints:
    /inventory/                       → items list
    /inventory/create/                → add item
    /inventory/<pk>/                  → item detail
    /inventory/<pk>/edit/             → edit item
    /inventory/<pk>/delete/           → delete item
    /inventory/<pk>/adjust/           → stock movement (in/out/adjust)
    /inventory/stock-monitoring/      → stock monitoring center
    /inventory/borrowed/              → borrowed items list
    /inventory/borrowed/create/       → record new borrowing
    /inventory/borrowed/<pk>/return/  → mark borrowed item returned
"""
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
from django.db.models import Q
from django.shortcuts import render, redirect, get_object_or_404
from django.utils import timezone

from accounts.models import SystemLog
from accounts.permissions import role_required
from notifications.models import Notification
from .forms import (InventoryItemForm, InventoryFilterForm, StockAdjustmentForm,
                    BorrowedItemForm, BorrowedFilterForm, ReturnBorrowedItemForm)
from .models import InventoryItem, StockMovement, BorrowedItem


# ===========================================================================
# Inventory items
# ===========================================================================
@login_required
def inventory_list(request):
    """Inventory items list with filters and search."""
    qs = InventoryItem.objects.all()

    form = InventoryFilterForm(request.GET or None)
    if form.is_valid():
        s = form.cleaned_data.get('search')
        category = form.cleaned_data.get('category')
        status = form.cleaned_data.get('stock_status')
        if s:
            qs = qs.filter(Q(name__icontains=s) | Q(item_code__icontains=s) | Q(description__icontains=s))
        if category:
            qs = qs.filter(category=category)
        # Stock status is computed — filter in Python for correctness
        items = list(qs.order_by('name'))
        if status:
            items = [i for i in items if i.stock_status == status]
    else:
        items = list(qs.order_by('name'))

    paginator = Paginator(items, 15)
    page_obj = paginator.get_page(request.GET.get('page'))

    return render(request, 'inventory/list.html', {
        'items': page_obj, 'filter_form': form, 'section': 'inventory',
    })


@login_required
@role_required('Administrator', 'Guidance Staff')
def inventory_create(request):
    if request.method == 'POST':
        form = InventoryItemForm(request.POST)
        if form.is_valid():
            item = form.save(commit=False)
            item.created_by = request.user
            item.save()
            SystemLog.log(
                user=request.user, action=SystemLog.ACTION_CREATE, entity='InventoryItem',
                entity_id=item.pk, description=f'Created item {item}', request=request,
            )
            messages.success(request, f'Item "{item.name}" has been added.')
            return redirect('inventory:detail', pk=item.pk)
    else:
        form = InventoryItemForm()
    return render(request, 'inventory/form.html', {'form': form, 'is_create': True, 'section': 'inventory'})


@login_required
def inventory_detail(request, pk):
    item = get_object_or_404(InventoryItem, pk=pk)
    movements = item.movements.select_related('performed_by')[:20]
    borrowed = item.borrowed_records.select_related('borrower_user')[:20]

    if request.method == 'POST':
        adjust_form = StockAdjustmentForm(request.POST)
        if adjust_form.is_valid():
            movement = adjust_form.save(commit=False)
            movement.item = item
            movement.performed_by = request.user
            qty = movement.quantity
            if movement.movement_type == StockMovement.MOVEMENT_OUT:
                qty = -abs(qty)
            elif movement.movement_type == StockMovement.MOVEMENT_IN:
                qty = abs(qty)
            else:
                pass  # adjust — sign retained
            item.quantity = max(0, item.quantity + qty)
            item.save()
            movement.balance_after = item.quantity
            movement.quantity = abs(movement.quantity)  # store magnitude; sign implied by movement_type
            movement.save()
            SystemLog.log(
                user=request.user, action=SystemLog.ACTION_UPDATE, entity='InventoryItem',
                entity_id=item.pk, description=f'Stock {movement.get_movement_type_display()}: {movement.quantity} {item.unit}',
                request=request,
            )
            # Trigger low-stock notification if applicable
            if item.stock_status == 'low_stock':
                Notification.create_for_role(
                    role_name='Administrator',
                    category=Notification.CATEGORY_LOW_STOCK,
                    priority=Notification.PRIORITY_NORMAL,
                    title=f'Low stock alert: {item.name}',
                    message=f'"{item.name}" is below reorder level ({item.quantity} {item.unit} left, reorder at {item.reorder_level}).',
                    link=f'/inventory/{item.pk}/',
                )
            elif item.stock_status == 'out_of_stock':
                Notification.create_for_role(
                    role_name='Administrator',
                    category=Notification.CATEGORY_LOW_STOCK,
                    priority=Notification.PRIORITY_HIGH,
                    title=f'Out of stock: {item.name}',
                    message=f'"{item.name}" is now OUT OF STOCK. Please restock immediately.',
                    link=f'/inventory/{item.pk}/',
                )
            messages.success(request, 'Stock adjusted successfully.')
            return redirect('inventory:detail', pk=item.pk)
    else:
        adjust_form = StockAdjustmentForm()

    return render(request, 'inventory/detail.html', {
        'item': item, 'movements': movements, 'borrowed': borrowed,
        'adjust_form': adjust_form, 'section': 'inventory',
    })


@login_required
@role_required('Administrator', 'Guidance Staff')
def inventory_edit(request, pk):
    item = get_object_or_404(InventoryItem, pk=pk)
    if request.method == 'POST':
        form = InventoryItemForm(request.POST, instance=item)
        if form.is_valid():
            updated = form.save()
            SystemLog.log(
                user=request.user, action=SystemLog.ACTION_UPDATE, entity='InventoryItem',
                entity_id=updated.pk, description=f'Updated item {updated}', request=request,
            )
            messages.success(request, 'Item updated.')
            return redirect('inventory:detail', pk=updated.pk)
    else:
        form = InventoryItemForm(instance=item)
    return render(request, 'inventory/form.html', {
        'form': form, 'is_create': False, 'item': item, 'section': 'inventory',
    })


@login_required
@role_required('Administrator', 'Guidance Staff')
def inventory_delete(request, pk):
    item = get_object_or_404(InventoryItem, pk=pk)
    if request.method == 'POST':
        SystemLog.log(
            user=request.user, action=SystemLog.ACTION_DELETE, entity='InventoryItem',
            entity_id=item.pk, description=f'Deleted item {item}', request=request,
        )
        item.delete()
        messages.success(request, 'Item deleted.')
        return redirect('inventory:list')
    return render(request, 'inventory/delete.html', {'item': item, 'section': 'inventory'})


# ===========================================================================
# Stock monitoring (Phase 20)
# ===========================================================================
@login_required
def stock_monitoring(request):
    """Stock Monitoring Center — KPIs + low-stock + out-of-stock lists."""
    all_items = list(InventoryItem.objects.all())
    available = [i for i in all_items if i.stock_status == 'available']
    low_stock = [i for i in all_items if i.stock_status == 'low_stock']
    out_of_stock = [i for i in all_items if i.stock_status == 'out_of_stock']

    return render(request, 'inventory/stock_monitoring.html', {
        'kpis': {
            'total': len(all_items),
            'available': len(available),
            'low_stock': len(low_stock),
            'out_of_stock': len(out_of_stock),
        },
        'low_stock': low_stock,
        'out_of_stock': out_of_stock,
        'section': 'inventory',
    })


# ===========================================================================
# Borrowed items (Phase 21)
# ===========================================================================
@login_required
def borrowed_list(request):
    # Auto-flag overdue borrowings
    BorrowedItem.mark_overdue()

    qs = BorrowedItem.objects.select_related('item', 'borrower_user')
    form = BorrowedFilterForm(request.GET or None)
    if form.is_valid():
        s = form.cleaned_data.get('search')
        status = form.cleaned_data.get('status')
        if s:
            qs = qs.filter(Q(borrower_name__icontains=s) | Q(item__name__icontains=s) | Q(item__item_code__icontains=s))
        if status:
            qs = qs.filter(status=status)
    qs = qs.order_by('-borrow_date')

    paginator = Paginator(qs, 15)
    borrowed = paginator.get_page(request.GET.get('page'))

    return render(request, 'inventory/borrowed_list.html', {
        'borrowed': borrowed, 'filter_form': form, 'section': 'inventory',
    })


@login_required
@role_required('Administrator', 'Guidance Staff')
def borrowed_create(request):
    if request.method == 'POST':
        form = BorrowedItemForm(request.POST)
        if form.is_valid():
            record = form.save(commit=False)
            record.recorded_by = request.user
            record.save()
            SystemLog.log(
                user=request.user, action=SystemLog.ACTION_CREATE, entity='BorrowedItem',
                entity_id=record.pk, description=f'Borrowed {record.quantity} × {record.item}',
                request=request,
            )
            messages.success(request, 'Borrowing recorded.')
            return redirect('inventory:borrowed_list')
    else:
        form = BorrowedItemForm(initial={'borrow_date': timezone.now().date()})
    return render(request, 'inventory/borrowed_form.html', {'form': form, 'is_create': True, 'section': 'inventory'})


@login_required
@role_required('Administrator', 'Guidance Staff')
def borrowed_return(request, pk):
    record = get_object_or_404(BorrowedItem, pk=pk)
    if request.method == 'POST':
        form = ReturnBorrowedItemForm(request.POST, instance=record)
        if form.is_valid():
            updated = form.save(commit=False)
            updated.status = BorrowedItem.STATUS_RETURNED
            if not updated.actual_return_date:
                updated.actual_return_date = timezone.now().date()
            updated.save()
            SystemLog.log(
                user=request.user, action=SystemLog.ACTION_UPDATE, entity='BorrowedItem',
                entity_id=updated.pk, description=f'Marked returned: {updated.item}', request=request,
            )
            messages.success(request, 'Item marked as returned.')
            return redirect('inventory:borrowed_list')
    else:
        form = ReturnBorrowedItemForm(instance=record, initial={'actual_return_date': timezone.now().date()})
    return render(request, 'inventory/borrowed_return.html', {
        'form': form, 'record': record, 'section': 'inventory',
    })

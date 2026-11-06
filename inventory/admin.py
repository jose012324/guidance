from django.contrib import admin

from .models import InventoryItem, StockMovement, BorrowedItem


@admin.register(InventoryItem)
class InventoryItemAdmin(admin.ModelAdmin):
    list_display = ('item_code', 'name', 'category', 'quantity', 'unit', 'reorder_level', 'stock_status')
    list_filter = ('category',)
    search_fields = ('item_code', 'name', 'description')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = ('item', 'movement_type', 'quantity', 'balance_after', 'performed_by', 'timestamp')
    list_filter = ('movement_type',)


@admin.register(BorrowedItem)
class BorrowedItemAdmin(admin.ModelAdmin):
    list_display = ('borrower_name', 'item', 'quantity', 'borrow_date', 'expected_return_date', 'status')
    list_filter = ('status',)
    search_fields = ('borrower_name', 'item__name')

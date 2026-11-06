/** Inventory item delete confirmation page. */
import { DeletePage } from '../components/DeletePage';
import { inventoryApi } from '../lib/api';

export async function InventoryDeletePage(pk: string): Promise<HTMLElement> {
  let name = `Item #${pk}`;
  let secondary = '';
  try {
    const res = await inventoryApi.detail(Number(pk));
    if (res.success && res.data) {
      const i = res.data.item;
      name = i.name;
      secondary = `${i.item_code} · ${i.quantity} ${i.unit} in stock`;
    }
  } catch { /* use defaults */ }

  return DeletePage({
    title: 'Delete Inventory Item',
    subtitle: 'This action cannot be undone.',
    entityName: name,
    entitySecondary: secondary,
    warning: 'All associated stock movement records and borrowing history will also be deleted.',
    backRoute: '/inventory',
    onDelete: () => inventoryApi.delete(Number(pk)),
    activeRoute: '/inventory',
  });
}

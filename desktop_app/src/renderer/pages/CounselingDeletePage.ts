/** Counseling session delete confirmation page. */
import { DeletePage } from '../components/DeletePage';
import { counselingApi } from '../lib/api';

export async function CounselingDeletePage(pk: string): Promise<HTMLElement> {
  let name = `Counseling Session #${pk}`;
  let secondary = '';
  try {
    const res = await counselingApi.detail(Number(pk));
    if (res.success && res.data) {
      const c = res.data.session;
      name = `Session — ${c.student.full_name}`;
      secondary = `${c.concern_type_display} · ${new Date(c.session_date).toLocaleDateString()}`;
    }
  } catch { /* use defaults */ }

  return DeletePage({
    title: 'Delete Counseling Session',
    subtitle: 'This action cannot be undone.',
    entityName: name,
    entitySecondary: secondary,
    backRoute: '/counseling',
    onDelete: () => counselingApi.delete(Number(pk)),
    activeRoute: '/counseling',
  });
}

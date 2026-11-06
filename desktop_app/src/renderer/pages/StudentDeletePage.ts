/** Student delete confirmation page. */
import { DeletePage } from '../components/DeletePage';
import { studentsApi } from '../lib/api';

export async function StudentDeletePage(pk: string): Promise<HTMLElement> {
  let name = `Student #${pk}`;
  let secondary = '';
  try {
    const res = await studentsApi.detail(Number(pk));
    if (res.success && res.data) {
      const s = res.data.student;
      name = s.full_name;
      secondary = `${s.student_number} · ${s.grade_level || ''} ${s.section || ''}`.trim();
    }
  } catch { /* use defaults */ }

  return DeletePage({
    title: 'Delete Student',
    subtitle: 'This action is permanent and cannot be undone.',
    entityName: name,
    entitySecondary: secondary,
    warning: 'All associated counseling sessions, referrals, and documents will also be deleted.',
    backRoute: '/students',
    onDelete: () => studentsApi.delete(Number(pk)),
    activeRoute: '/students',
  });
}

/** User delete confirmation page. */
import { DeletePage } from '../components/DeletePage';
import { usersApi } from '../lib/api';
import { getUser } from '../lib/auth';

export async function UserDeletePage(pk: string): Promise<HTMLElement> {
  // Safety check — can't delete your own account
  const me = getUser();
  if (me && me.id === Number(pk)) {
    return DeletePage({
      title: 'Action Not Allowed',
      subtitle: 'You cannot delete your own account.',
      entityName: me.full_name,
      entitySecondary: me.username,
      backRoute: '/users',
      onDelete: async () => { /* no-op */ },
      activeRoute: '/users',
    });
  }

  // Try to fetch the user details
  let name = `User #${pk}`;
  let secondary = '';
  try {
    const res = await usersApi.detail(Number(pk));
    if (res.success && res.data) {
      name = res.data.user.full_name;
      secondary = res.data.user.username;
    }
  } catch { /* use defaults */ }

  return DeletePage({
    title: 'Delete User',
    subtitle: 'This action is permanent and cannot be undone.',
    entityName: name,
    entitySecondary: secondary ? `@${secondary}` : '',
    warning: 'All associated records (audit logs, etc.) will be preserved for compliance, but the user will no longer be able to log in.',
    backRoute: '/users',
    onDelete: () => usersApi.delete(Number(pk)),
    activeRoute: '/users',
  });
}

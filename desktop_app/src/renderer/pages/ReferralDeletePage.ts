/** Referral delete confirmation page. */
import { DeletePage } from '../components/DeletePage';
import { referralsApi } from '../lib/api';

export async function ReferralDeletePage(pk: string): Promise<HTMLElement> {
  let name = `Referral #${pk}`;
  let secondary = '';
  try {
    const res = await referralsApi.detail(Number(pk));
    if (res.success && res.data) {
      const r = res.data.referral;
      name = `Referral #${r.id} — ${r.student.full_name}`;
      secondary = `${r.referral_type_display} · ${r.priority_display} priority · ${r.status_display}`;
    }
  } catch { /* use defaults */ }

  return DeletePage({
    title: 'Delete Referral',
    subtitle: 'This action cannot be undone.',
    entityName: name,
    entitySecondary: secondary,
    backRoute: '/referrals',
    onDelete: () => referralsApi.delete(Number(pk)),
    activeRoute: '/referrals',
  });
}

/** Account settings page — profile + password change. */
import { div, span, button, icon, el } from '../lib/dom';
import { accountApi, resolveMediaUrl } from '../lib/api';
import { pageWrapper, loadingEl } from '../components/PageWrapper';
import { getUser, setUser } from '../lib/auth';
import { toastSuccess, toastError } from '../lib/toast';

export async function AccountPage(): Promise<HTMLElement> {
  const user = getUser();
  const body = div('', [loadingEl()]);
  const shell = await pageWrapper('/account', 'Account Settings', 'Manage your profile, password, and preferences.', [body], []);

  if (user) {
    body.innerHTML = '';
    body.appendChild(div('row g-3', [
      div('col-lg-7', [
        div('card', [
          div('card-header', [icon('person-circle'), span('', ['Profile Information'])]),
          div('card-body', [profileForm(user)]),
        ]),
      ]),
      div('col-lg-5', [
        div('card', [
          div('card-header', [icon('key'), span('', ['Change Password'])]),
          div('card-body', [passwordForm()]),
        ]),
        div('card mt-3', [
          div('card-header', [icon('info-circle'), span('', ['Account Info'])]),
          div('card-body', [
            descList([
              ['Username', user.username],
              ['Employee ID', user.employee_id || '—'],
              ['Role', user.role?.name || '—'],
              ['Status', `<span class="badge ${user.status}">${user.status_display}</span>`, true],
              ['Date Joined', user.date_joined ? new Date(user.date_joined).toLocaleDateString() : '—'],
            ]),
          ]),
        ]),
      ]),
    ]));
  }

  function profileForm(user: any): HTMLElement {
    const form = el('form', '') as HTMLFormElement;

    // Avatar section
    const avatarUrl = resolveMediaUrl(user.avatar);
    const avatarImg = document.createElement('img') as HTMLImageElement;
    avatarImg.style.cssText = 'width:110px;height:110px;object-fit:cover;border-radius:50%;border:3px solid var(--border);';
    avatarImg.alt = 'avatar';
    const avatarPlaceholder = div('rounded-circle d-flex align-items-center justify-content-center', [
      (user.first_name?.[0] || user.username?.[0] || 'U').toUpperCase(),
    ], { style: 'width:110px;height:110px;background:var(--accent);color:#fff;font-size:2.5rem;font-family:var(--font-serif);' }) as HTMLDivElement;

    if (avatarUrl) {
      avatarImg.src = avatarUrl;
      avatarImg.style.display = 'block';
      avatarPlaceholder.style.display = 'none';
    } else {
      avatarImg.style.display = 'none';
    }

    const avatarInput = el('input', 'form-control') as HTMLInputElement;
    avatarInput.type = 'file';
    avatarInput.accept = 'image/*';
    avatarInput.id = 'desktopAvatarInput';

    const cameraBtn = el('label', 'rounded-circle d-flex align-items-center justify-content-center', [icon('camera-fill')], {
      for: 'desktopAvatarInput',
      style: 'position:absolute;bottom:0;right:0;width:34px;height:34px;background:var(--accent);color:#fff;cursor:pointer;box-shadow:var(--shadow-md);border:2px solid var(--bg);',
    }) as HTMLLabelElement;

    const avatarWrap = div('', [avatarPlaceholder, avatarImg, cameraBtn], { style: 'position:relative;display:inline-block;width:110px;height:110px;' });
    const avatarSection = div('mb-4', [
      avatarWrap,
      el('p', 'text-muted-soft small mt-2', ['Click the camera icon to upload a new picture.']),
    ], { style: 'display:flex;flex-direction:column;align-items:center;text-align:center;' });

    avatarInput.addEventListener('change', function () {
      const file = this.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          avatarImg.src = e.target?.result as string;
          avatarImg.style.display = 'block';
          avatarPlaceholder.style.display = 'none';
        };
        reader.readAsDataURL(file);
      }
    });

    // Text fields
    const fn = el('input', 'form-control') as HTMLInputElement; fn.value = user.first_name;
    const mn = el('input', 'form-control') as HTMLInputElement; mn.value = user.middle_name;
    const ln = el('input', 'form-control') as HTMLInputElement; ln.value = user.last_name;
    const em = el('input', 'form-control') as HTMLInputElement; em.type = 'email'; em.value = user.email;
    const cn = el('input', 'form-control') as HTMLInputElement; cn.value = user.contact_number;

    form.appendChild(avatarSection);
    form.appendChild(div('row g-3', [
      div('col-md-4', [el('label', 'form-label', ['First Name']), fn]),
      div('col-md-4', [el('label', 'form-label', ['Middle Name']), mn]),
      div('col-md-4', [el('label', 'form-label', ['Last Name']), ln]),
      div('col-md-6', [el('label', 'form-label', ['Email']), em]),
      div('col-md-6', [el('label', 'form-label', ['Contact Number']), cn]),
      div('col-12', [el('label', 'form-label', ['Profile Picture']), avatarInput]),
    ]));
    const submit = button('btn btn-primary mt-3', [icon('save'), span('', ['Save Changes'])]);
    form.appendChild(div('d-flex justify-content-end mt-3', [submit]));
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); submit.disabled = true;
      try {
        // Upload avatar first if a file is selected
        if (avatarInput.files && avatarInput.files.length > 0) {
          const avatarRes = await accountApi.uploadAvatar(avatarInput.files[0]);
          if (avatarRes.success && avatarRes.data) {
            setUser(avatarRes.data.user);
          }
        }
        // Then save text fields
        const res = await accountApi.updateProfile({ first_name: fn.value, middle_name: mn.value, last_name: ln.value, email: em.value, contact_number: cn.value });
        if (res.success && res.data) { setUser(res.data.user); toastSuccess('Profile updated'); }
      } catch (err: any) { toastError(err.message); }
      finally { submit.disabled = false; }
    });
    return form;
  }

  function passwordForm(): HTMLElement {
    const form = el('form', '') as HTMLFormElement;
    const oldP = el('input', 'form-control') as HTMLInputElement; oldP.type = 'password'; oldP.required = true;
    const newP = el('input', 'form-control') as HTMLInputElement; newP.type = 'password'; newP.required = true;
    const conP = el('input', 'form-control') as HTMLInputElement; conP.type = 'password'; conP.required = true;
    form.appendChild(div('mb-3', [el('label', 'form-label', ['Current Password']), oldP]));
    form.appendChild(div('mb-3', [el('label', 'form-label', ['New Password']), newP]));
    form.appendChild(div('mb-3', [el('label', 'form-label', ['Confirm Password']), conP]));
    const submit = button('btn btn-primary', [icon('shield-lock'), span('', ['Update Password'])]);
    form.appendChild(div('d-flex justify-content-end', [submit]));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (newP.value !== conP.value) { toastError('Passwords do not match'); return; }
      submit.disabled = true;
      try { await accountApi.changePassword({ old_password: oldP.value, new_password1: newP.value, new_password2: conP.value }); toastSuccess('Password changed'); form.reset(); }
      catch (err: any) { toastError(err.message); submit.disabled = false; }
    });
    return form;
  }

  function descList(rows: [string, string, boolean?][]): HTMLElement {
    const dl = el('dl', 'row mb-0', []) as HTMLElement;
    for (const [k, v, asHtml] of rows) {
      dl.appendChild(el('dt', 'text-muted-soft', [k], { style: 'flex: 0 0 40%;' }));
      const dd = el('dd', '', [], { style: 'flex: 1; margin-left: 0;' });
      // Default to textContent so user-controlled data (employee_id, etc.)
      // can never inject HTML; only trusted markup may opt into asHtml.
      if (asHtml) dd.innerHTML = v; else dd.textContent = v;
      dl.appendChild(dd);
    }
    return dl;
  }

  return shell;
}

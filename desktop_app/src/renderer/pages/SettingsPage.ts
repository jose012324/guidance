/** School settings page (admin only). */
import { div, span, button, icon, el } from '../lib/dom';
import { settingsApi, resolveMediaUrl } from '../lib/api';
import { pageWrapper, loadingEl } from '../components/PageWrapper';
import { toastSuccess, toastError } from '../lib/toast';
import { applySchoolBrand } from '../components/AppShell';

export async function SettingsPage(): Promise<HTMLElement> {
  const body = div('', [loadingEl()]);
  const shell = await pageWrapper('/settings', 'School Settings', 'Configure school identity, branding, and system defaults.', [body], []);

  try {
    const res = await settingsApi.get();
    if (res.success && res.data) {
      const s = res.data.settings;
      body.innerHTML = '';
      const form = el('form', '') as HTMLFormElement;

      // School Information card
      const schoolInfoCard = div('card mb-3', [
        div('card-header', [icon('building'), span('', ['School Information'])]),
        div('card-body', [
          div('row g-3', [
            div('col-md-6', [el('label', 'form-label', ['School Name']), (() => { const i = el('input', 'form-control') as HTMLInputElement; i.type = 'text'; i.name = 'school_name'; i.value = s.school_name; return i; })()]),
            div('col-md-6', [el('label', 'form-label', ['School Year']), (() => { const i = el('input', 'form-control') as HTMLInputElement; i.type = 'text'; i.name = 'school_year'; i.value = s.school_year; return i; })()]),
            div('col-12', [el('label', 'form-label', ['School Address']), (() => { const t = el('textarea', 'form-control') as HTMLTextAreaElement; t.rows = 2; t.name = 'school_address'; t.value = s.school_address || ''; return t; })()]),
            div('col-md-6', [el('label', 'form-label', ['Contact Email']), (() => { const i = el('input', 'form-control') as HTMLInputElement; i.type = 'email'; i.name = 'contact_email'; i.value = s.contact_email; return i; })()]),
            div('col-md-6', [el('label', 'form-label', ['Contact Phone']), (() => { const i = el('input', 'form-control') as HTMLInputElement; i.type = 'text'; i.name = 'contact_phone'; i.value = s.contact_phone; return i; })()]),
          ]),
        ]),
      ]);

      // Branding & System card
      const logoPreview = s.school_logo
        ? (() => { const img = document.createElement('img'); img.src = resolveMediaUrl(s.school_logo)!; img.alt = 'Current logo'; img.style.cssText = 'max-height:60px;max-width:200px;margin-top:.5rem;border-radius:4px;'; return img; })()
        : span('text-muted-soft small', ['No logo uploaded']);
      const logoInput = el('input', 'form-control') as HTMLInputElement;
      logoInput.type = 'file';
      logoInput.accept = 'image/*';
      logoInput.id = 'logoFileInput';
      const logoPreviewDiv = div('', [logoPreview]);

      const brandingCard = div('card mb-3', [
        div('card-header', [icon('sliders'), span('', ['Branding & System'])]),
        div('card-body', [
          div('row g-3', [
            div('col-12', [el('label', 'form-label', ['System Title']), (() => { const i = el('input', 'form-control') as HTMLInputElement; i.type = 'text'; i.name = 'system_title'; i.value = s.system_title; return i; })()]),
            div('col-12', [el('label', 'form-label', ['Footer Text']), (() => { const i = el('input', 'form-control') as HTMLInputElement; i.type = 'text'; i.name = 'footer_text'; i.value = s.footer_text; return i; })()]),
            div('col-md-6', [el('label', 'form-label', ['Default Theme']), (() => { const sel = el('select', 'form-select') as HTMLSelectElement; sel.name = 'default_theme'; sel.appendChild(new Option('Light Mode', 'light')); sel.appendChild(new Option('Dark Mode', 'dark')); if (s.default_theme === 'dark') sel.selectedIndex = 1; return sel; })()]),
            div('col-md-6', [
              el('label', 'form-label', ['School Logo']),
              logoInput,
              logoPreviewDiv,
            ]),
          ]),
        ]),
      ]);

      // About Settings info card
      const aboutCard = div('card', [
        div('card-header', [icon('info-circle'), span('', ['About Settings'])]),
        div('card-body', [
          el('p', 'small text-muted-soft', ['These settings appear on the public landing page, login screen, and throughout the dashboard sidebar.']),
          el('p', 'small text-muted-soft mb-0', ['Theme changes apply to new visitors only - existing users can toggle their own theme via the sun/moon icon in the top bar.']),
        ]),
      ]);

      // Build the layout
      body.appendChild(form);
      form.appendChild(div('row g-3', [
        div('col-lg-8', [schoolInfoCard, brandingCard]),
        div('col-lg-4', [aboutCard]),
      ]));

      // Action buttons
      const submitBtn = button('btn btn-primary', [icon('save'), span('', ['Save Settings'])]);
      submitBtn.type = 'submit';
      form.appendChild(div('d-flex justify-content-end gap-2 mt-3', [
        button('btn btn-outline-secondary', [span('', ['Cancel'])], () => window.location.reload()),
        submitBtn,
      ]));

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        submitBtn.disabled = true;
        try {
          // Upload logo first if a file is selected
          if (logoInput.files && logoInput.files.length > 0) {
            await settingsApi.uploadLogo(logoInput.files[0]);
          }
          // Then save text fields
          const formData = new FormData(form);
          const data: any = {};
          formData.forEach((value, key) => {
            if (key !== 'school_logo') data[key] = value;
          });
          const updated = await settingsApi.update(data);
          if (updated.data?.settings) applySchoolBrand(updated.data.settings);
          toastSuccess('Settings updated');
          // Update logo preview
          if (logoInput.files && logoInput.files.length > 0) {
            const url = URL.createObjectURL(logoInput.files[0]);
            logoPreviewDiv.innerHTML = '';
            const img = document.createElement('img');
            img.src = url;
            img.alt = 'New logo';
            img.style.cssText = 'max-height:60px;max-width:200px;margin-top:.5rem;border-radius:4px;';
            logoPreviewDiv.appendChild(img);
          }
        } catch (err: any) {
          toastError(err.message);
          submitBtn.disabled = false;
        }
      });
    }
  } catch (e: any) { body.innerHTML = `<div class="empty-state"><i class="bi bi-exclamation-triangle"></i><h4>Failed</h4><p>${e.message}</p></div>`; }
  return shell;
}

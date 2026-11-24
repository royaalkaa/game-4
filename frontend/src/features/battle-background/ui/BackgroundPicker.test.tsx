import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiUrl } from '@/shared/api';
import { makeAdminBattle } from '@test/fixtures';
import { BackgroundPicker } from './BackgroundPicker';

const sent: { method: string; url: string; form: FormData; xhr: FakeXhr }[] = [];

class FakeXhr {
  status = 0;
  responseText = '';
  withCredentials = false;
  upload = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private method = '';
  private url = '';

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  send(form: FormData) {
    sent.push({ method: this.method, url: this.url, form, xhr: this });
  }

  respond(status: number, body: unknown) {
    this.status = status;
    this.responseText = JSON.stringify(body);
    this.onload?.();
  }
}

describe('BackgroundPicker', () => {
  afterEach(() => {
    sent.length = 0;
    vi.unstubAllGlobals();
  });

  it('uploads the chosen picture with PUT and refreshes the battle', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
    const refresh = vi.fn();
    render(<BackgroundPicker battle={makeAdminBattle()} battleId="7" refresh={refresh} />);

    await userEvent.upload(screen.getByLabelText('Выбрать фон'), new File(['x'], 'bg.jpg', { type: 'image/jpeg' }));

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]!.method).toBe('PUT');
    expect(sent[0]!.url).toBe(apiUrl('adminBackground', { battleId: 7 }));
    expect((sent[0]!.form.get('file') as File).name).toBe('bg.jpg');
    sent[0]!.xhr.respond(200, makeAdminBattle({ background_url: '/media/abc.jpg' }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it('shows the current background and removes it', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(makeAdminBattle()), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const refresh = vi.fn();
    render(
      <BackgroundPicker battle={makeAdminBattle({ background_url: '/media/abc.jpg' })} battleId="7" refresh={refresh} />,
    );

    expect(screen.getByAltText('Текущий фон')).toHaveAttribute('src', '/media/abc.jpg');
    await userEvent.click(screen.getByRole('button', { name: 'Убрать фон' }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(apiUrl('adminBackground', { battleId: 7 }));
    expect(init.method).toBe('DELETE');
  });

  it('shows the server error', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
    const refresh = vi.fn();
    render(<BackgroundPicker battle={makeAdminBattle()} battleId="7" refresh={refresh} />);

    await userEvent.upload(screen.getByLabelText('Выбрать фон'), new File(['x'], 'broken.jpg', { type: 'image/jpeg' }));
    await waitFor(() => expect(sent).toHaveLength(1));
    sent[0]!.xhr.respond(400, { error: { code: 'bad_image', message: 'Нужна картинка JPEG, PNG или WebP' } });

    expect(await screen.findByRole('alert')).toHaveTextContent('Нужна картинка JPEG, PNG или WebP');
    expect(refresh).not.toHaveBeenCalled();
  });
});

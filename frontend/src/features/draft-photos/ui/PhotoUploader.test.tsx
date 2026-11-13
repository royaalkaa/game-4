import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { apiUrl } from '@/shared/api';
import { makePhoto } from '@test/fixtures';
import { PhotoUploader } from './PhotoUploader';

interface Sent {
  url: string;
  form: FormData;
  xhr: FakeXhr;
}

const sent: Sent[] = [];

class FakeXhr {
  status = 0;
  responseText = '';
  withCredentials = false;
  upload: { onprogress: ((event: { lengthComputable: boolean; loaded: number; total: number }) => void) | null } = {
    onprogress: null,
  };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private url = '';

  open(_method: string, url: string) {
    this.url = url;
  }

  send(form: FormData) {
    sent.push({ url: this.url, form, xhr: this });
  }

  respond(status: number, body: unknown) {
    this.status = status;
    this.responseText = JSON.stringify(body);
    this.onload?.();
  }
}

describe('PhotoUploader', () => {
  it('uploads selected files with captions, shows progress and reports errors', async () => {
    sent.length = 0;
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
    const onUploaded = vi.fn();
    render(<PhotoUploader battleId="1" onUploaded={onUploaded} />);

    const files = [
      new File(['a'], 'sea.jpg', { type: 'image/jpeg' }),
      new File(['b'], 'huge.png', { type: 'image/png' }),
    ];
    await userEvent.upload(screen.getByLabelText('Выбрать файлы'), files);
    await userEvent.type(screen.getByLabelText('Подпись к sea.jpg'), 'Море');
    await userEvent.click(screen.getByRole('button', { name: 'Загрузить: 2' }));

    await waitFor(() => expect(sent).toHaveLength(1));
    const first = sent[0]!;
    expect(first.url).toBe(apiUrl('adminPhotos', { battleId: 1 }));
    expect(first.form.get('caption')).toBe('Море');
    expect(first.xhr.withCredentials).toBe(true);

    first.xhr.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 });
    expect(await screen.findByRole('progressbar', { name: 'Загрузка sea.jpg' })).toHaveAttribute(
      'aria-valuenow',
      '50',
    );
    first.xhr.respond(200, makePhoto(1, 'Море'));

    await waitFor(() => expect(sent).toHaveLength(2));
    expect(sent[1]!.form.get('caption')).toBeNull();
    sent[1]!.xhr.respond(413, { error: { code: 'too_large', message: 'Файл больше 10 МБ' } });

    expect(await screen.findByText('Файл больше 10 МБ')).toBeInTheDocument();
    expect(screen.queryByText('sea.jpg')).not.toBeInTheDocument();
    expect(screen.getByText('huge.png')).toBeInTheDocument();
    expect(onUploaded).toHaveBeenCalledTimes(1);
  });
});

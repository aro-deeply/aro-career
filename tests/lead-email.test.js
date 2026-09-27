import test from 'node:test';
import assert from 'node:assert/strict';

test('진단 문의는 운영자 Gmail로 보내고, 발송 실패를 접수 성공으로 표시하지 않는다', async () => {
  const previousApiKey = process.env.RESEND_API_KEY;
  const previousFrom = process.env.RESEND_FROM;
  const previousFetch = globalThis.fetch;
  const requests = [];
  process.env.RESEND_API_KEY = 'test-api-key';
  process.env.RESEND_FROM = 'ARO <onboarding@resend.dev>';
  globalThis.fetch = async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return new Response(JSON.stringify({
      name: 'validation_error',
      message: 'Synthetic send failure for test',
    }), {status: 401, headers: {'content-type': 'application/json'}});
  };

  try {
    const {default: handler} = await import('../api/lead.js');
    const response = {
      statusCode: undefined,
      body: undefined,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
    };
    await handler({
      method: 'POST',
      body: {
        name: '테스트',
        email: 'applicant@example.com',
        consent: true,
        diagnosis: {},
      },
    }, response);

    assert.equal(response.statusCode, 502);
    assert.match(response.body.error, /메일을 전달하지 못했습니다/);
    assert.equal(requests.length, 1);
    assert.deepEqual(requests[0].to, ['aro.deeply@gmail.com']);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousApiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previousApiKey;
    if (previousFrom === undefined) delete process.env.RESEND_FROM;
    else process.env.RESEND_FROM = previousFrom;
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  execute(msg.tool, msg.params)
    .then(sendResponse)
    .catch(err => sendResponse({ __error: err.message }));
  return true; // keep message channel open for async response
});

async function execute(tool, params) {
  switch (tool) {
    case 'get_content': {
      if (params.selector) {
        const el = document.querySelector(params.selector);
        if (!el) throw new Error(`Element not found: ${params.selector}`);
        return el.innerText !== '' ? el.innerText : el.innerHTML;
      }
      return document.documentElement.outerHTML;
    }

    case 'click': {
      const el = document.querySelector(params.selector);
      if (!el) throw new Error(`Element not found: ${params.selector}`);
      el.click();
      return 'clicked';
    }

    case 'fill': {
      const el = document.querySelector(params.selector);
      if (!el) throw new Error(`Element not found: ${params.selector}`);
      el.focus();
      el.value = params.value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return 'filled';
    }

    case 'wait': {
      const timeout = params.timeout ?? 10000;
      const interval = 200;
      let elapsed = 0;
      while (elapsed <= timeout) {
        if (document.querySelector(params.selector)) return 'found';
        await new Promise(r => setTimeout(r, interval));
        elapsed += interval;
      }
      throw new Error(`Timeout waiting for: ${params.selector}`);
    }

    case 'evaluate': {
      // eslint-disable-next-line no-eval
      const result = eval(params.script);
      return String(result ?? '');
    }

    default:
      throw new Error(`Unknown tool: ${tool}`);
  }
}

# Web Presentations

Create, refine, and export interactive HTML presentations with Codex or Claude Code. Navigate main slides vertically and detail slides horizontally, then share the finished deck as a ZIP that opens in a browser.

## Install

You'll need a recent version of [Codex CLI](https://developers.openai.com/codex/cli) or [Claude Code](https://code.claude.com/docs/en/setup), Git, and Python 3.10 or later. The presentation runtime is included; no npm install or build step is needed to use the plugin.

### Codex

Run in your terminal:

```sh
codex features enable plugins
codex plugin marketplace add VirajShah21/web-presentations
codex plugin add web-presentations@web-presentations
```

Start a new Codex session. If you use the desktop app, restart it after installation. If your CLI doesn't recognize `plugin add`, update Codex or install **Web Presentations** from the added marketplace in the desktop app's Plugins directory.

### Claude Code

Run in your terminal:

```sh
claude plugin marketplace add VirajShah21/web-presentations
claude plugin install web-presentations@web-presentations
```

Start a new Claude Code session to load the plugin.

Installation reference: [Codex marketplaces](https://developers.openai.com/plugins/build/plugins#add-a-marketplace-from-the-cli) · [Claude Code plugins](https://code.claude.com/docs/en/discover-plugins#add-a-marketplace).

## Use it

Ask your assistant:

> Use Web Presentations to create a five-slide introduction to our product for new customers. Use dark mode and accent color #4357C5. Include one horizontal detail slide and package the result as a ZIP.

The plugin includes three skills:

- **Create web presentation:** build a new deck, edit slides, and export a ZIP.
- **Refine web presentation:** improve typography, diagrams, spacing, and interactions in an existing deck.
- **Upgrade presentation scroll:** update an older deck's navigation while preserving its content.

Unzip the finished presentation and open `index.html` in a browser. Use the arrow keys, trackpad, or on-screen controls to navigate. Local assets work offline; external embeds need an internet connection.

## Development

Only needed when changing the bundled runtime:

```sh
cd plugin
npm ci
npm run build
```

From the `plugin/` directory, run the scroll-upgrade regression tests with `python3 -m unittest discover -s tests -p 'test_*.py'`.

## License

[MIT](LICENSE). Bundled dependency licenses are listed in [Third-party notices](THIRD_PARTY_NOTICES.md).

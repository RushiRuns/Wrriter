# Raw HTML and Script Tags

<div class="custom-card" style="border: 1px solid #ccc; padding: 12px;">
  <p>This is a paragraph inside a raw HTML block with <span style="color: blue;">blue text</span>.</p>
</div>

<script>
  console.log("Malicious script attempt - must never run");
  window.__wrriter_compromised = true;
</script>

Raw HTML and script tags must show as plain text and must NEVER be executed.

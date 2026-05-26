const selected = canvas.tokens.controlled.filter((token) => token.actor);

if (!selected.length) {
  ui.notifications.warn("Select at least one token before applying wounds.");
} else {
  new Dialog({
    title: "Apply Wounds",
    content: `
      <form>
        <div class="form-group">
          <label>Excess Damage</label>
          <input type="number" name="excess" value="1" min="1" step="1" />
        </div>
      </form>
    `,
    buttons: {
      apply: {
        icon: '<i class="fas fa-blood"></i>',
        label: "Apply",
        callback: async (html) => {
          const excess = Math.max(1, Math.floor(Number(html.find('[name="excess"]').val()) || 1));
          for (const token of selected) {
            await token.actor.applyWounds(excess);
          }
        },
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: "Cancel",
      },
    },
    default: "apply",
  }).render(true);
}

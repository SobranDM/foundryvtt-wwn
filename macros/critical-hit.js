const selected = canvas.tokens.controlled.filter((token) => token.actor);

if (!selected.length) {
  ui.notifications.warn("Select at least one token before rolling a critical wound.");
} else {
  new Dialog({
    title: "Critical Wound",
    content: `
      <form>
        <div class="form-group">
          <label>Excess Damage</label>
          <input type="number" name="excess" value="1" min="1" step="1" />
        </div>
        <p class="notes">Uses the system wound method, including actor injury count and Injury Resistance.</p>
      </form>
    `,
    buttons: {
      roll: {
        icon: '<i class="fas fa-dice-d20"></i>',
        label: "Roll Wound",
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
    default: "roll",
  }).render(true);
}

new Dialog({
  title: "Ironsworn Action Roll",
  content: `
    <form>
      <div class="form-group">
        <label>Add</label>
        <input type="number" name="add" value="0" min="0" max="10" step="1" />
      </div>
    </form>
  `,
  buttons: {
    roll: {
      icon: '<i class="fas fa-dice-d20"></i>',
      label: "Roll",
      callback: async (html) => {
        const add = Math.floor(Number(html.find('[name="add"]').val()) || 0);
        const actionRoll = await new Roll(`1d6 + ${add}`).evaluate({ async: true });
        const challengeOne = await new Roll("1d10").evaluate({ async: true });
        const challengeTwo = await new Roll("1d10").evaluate({ async: true });
        const outcome = getOutcomeText(actionRoll.total, challengeOne.total, challengeTwo.total);

        await ChatMessage.create({
          speaker: ChatMessage.getSpeaker(),
          rolls: [actionRoll, challengeOne, challengeTwo],
          content: `
            <h2>Ironsworn Action Roll</h2>
            <p><b>Action:</b> ${actionRoll.result} = ${actionRoll.total}</p>
            <p><b>Challenge:</b> ${challengeOne.total} and ${challengeTwo.total}</p>
            <p>${outcome}</p>
          `,
        });
      },
    },
  },
  default: "roll",
}).render(true);

function getOutcomeText(actionTotal, challengeOne, challengeTwo) {
  const matches = actionTotal === challengeOne || actionTotal === challengeTwo;
  const strongHit = actionTotal > challengeOne && actionTotal > challengeTwo;
  const weakHit = actionTotal > Math.min(challengeOne, challengeTwo);

  if (matches) return "<b>Match:</b> Something exceptional happens.";
  if (strongHit) return "<b>Strong Hit:</b> Full success.";
  if (weakHit) return "<b>Weak Hit:</b> Success with a complication or cost.";
  return "<b>Miss:</b> Face danger.";
}

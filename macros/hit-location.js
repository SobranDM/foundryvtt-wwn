const hitLocations = [
  { min: 1, max: 3, name: "Right Leg", details: "Includes right hip and thigh." },
  { min: 4, max: 6, name: "Left Leg", details: "Includes left hip and thigh." },
  { min: 7, max: 9, name: "Abdomen", details: "Includes groin and lower torso." },
  { min: 10, max: 12, name: "Chest", details: "Includes upper torso and back." },
  { min: 13, max: 15, name: "Right Arm", details: "Includes right shoulder." },
  { min: 16, max: 18, name: "Left Arm", details: "Includes left shoulder." },
  { min: 19, max: 20, name: "Head", details: "Includes neck." },
];

const roll = await new Roll("1d20").evaluate({ async: true });
const location = hitLocations.find((entry) => roll.total >= entry.min && roll.total <= entry.max);

await ChatMessage.create({
  user: game.user.id,
  speaker: ChatMessage.getSpeaker(),
  flavor: "Hit Location",
  rolls: [roll],
  content: `
    <h2>Hit Location</h2>
    <p><b>Roll:</b> ${roll.total}</p>
    <p><b>${location.name}</b> (${location.min}-${location.max})</p>
    <p>${location.details}</p>
  `,
});

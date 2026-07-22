import WwnItemBase from "./base.mjs";
import {
  resolveCommitmentOptions,
  usesSharedPool,
  getInternalCommitment,
  normalizeInternalResourceLength,
} from "../../config/power-subtypes.mjs";
import { formatCommitmentSummary, poolCommittedTotal, formatCommitmentChoicesTab, formatCommitmentChoicesTabTitle, formatPoolCommittedTab, formatPoolCommittedTabCompact, formatPoolCommittedTabTooltip } from "../../helpers/commitment.mjs";

const fields = foundry.data.fields;

const COMMITMENT = ["none", "active", "scene", "day"];
const INTERNAL_USE_REFRESH = ["scene", "day"];

/**
 * Power: consolidated arts, spells, abilities, psychic techniques,
 * cyberware, mutations, Godbound gifts, and custom types.
 *
 * Sheet visibility: CONFIG.WWN.getPowerSheetVisibility(subType, system).
 */
export default class WwnPower extends WwnItemBase {
  static defineSchema() {
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.subType = new fields.StringField({
      required: true,
      choices: ["art", "spell", "ability", "psychic", "cyberware", "mutation", "gift", "custom"],
      initial: "art",
    });
    schema.customTypeName = new fields.StringField({ required: true, blank: true });
    schema.source = new fields.StringField({ required: true, blank: true });

    /* Resource model */
    schema.resourceName = new fields.StringField({ required: true, blank: true });
    schema.commitmentOptions = new fields.ArrayField(
      new fields.SchemaField({
        cost: new fields.NumberField({ ...requiredInteger, initial: 1, min: 0 }),
        length: new fields.StringField({ required: true, choices: COMMITMENT, initial: "scene" }),
        note: new fields.StringField({ required: true, blank: true }),
      }),
      { initial: [] }
    );
    schema.poolCommitted = new fields.SchemaField({
      none: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      active: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      scene: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      day: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
    });
    schema.internalResource = new fields.SchemaField({
      value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      max: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
    });
    schema.internalResourceLength = new fields.StringField({
      required: true,
      choices: INTERNAL_USE_REFRESH,
      initial: "scene",
    });
    schema.isActive = new fields.BooleanField({ initial: false });
    /** Scene/day only: apply embedded AEs to caster on use (`self`) or via chat targets button. */
    schema.effectApplication = new fields.StringField({
      required: true,
      choices: ["self", "targets"],
      initial: "self",
    });

    /* Spell-specific */
    schema.level = new fields.NumberField({ ...requiredInteger, initial: 1, min: 0 });
    schema.prepared = new fields.BooleanField({ initial: false });

    /* Strain */
    /** Permanent max-strain reduction while installed (cyberware / custom). */
    schema.permanentStrain = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });
    /** Use-time strain on the activator (stored as string: "", "1", "0,1"). */
    schema.userStrain = new fields.StringField({ required: true, blank: true });
    /** Use-time strain on targets (chat card button). */
    schema.targetStrain = new fields.StringField({ required: true, blank: true });

    /* Cyberware */
    schema.installed = new fields.BooleanField({ initial: false });
    schema.alienationCost = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });

    /* Activation (generic, never damage-converted) */
    schema.activation = new fields.SchemaField({
      roll: new fields.StringField({ required: true, blank: true }),
      rollType: new fields.StringField({
        required: true,
        choices: ["result", "above", "below"],
        initial: "result",
      }),
      rollTarget: new fields.NumberField({ ...requiredInteger, initial: 0 }),
      save: new fields.StringField({ required: true, blank: true }),
      range: new fields.StringField({ required: true, blank: true }),
      duration: new fields.StringField({ required: true, blank: true }),
    });

    schema.damageRoll = new fields.StringField({ required: true, blank: true });
    schema.healing = new fields.BooleanField({ initial: false });

    return schema;
  }

  get usesSharedPool() {
    return usesSharedPool(this.subType, this);
  }

  /** Resolved shared-pool commitment tiers for this power (paid options only). */
  get effectiveCommitmentOptions() {
    return resolveCommitmentOptions(this.subType, this).filter((o) => o.cost > 0);
  }

  get internalCommitment() {
    return getInternalCommitment(this.subType, this);
  }

  get poolCommittedSum() {
    return poolCommittedTotal(this.poolCommitted);
  }

  get commitmentSummary() {
    return formatCommitmentSummary(this.effectiveCommitmentOptions);
  }

  /** Powers tab: commitment length choices without cost (e.g. "Scene, Day"). */
  get tabCommitmentChoices() {
    return formatCommitmentChoicesTab(this.effectiveCommitmentOptions);
  }

  get tabCommitmentChoicesTitle() {
    return formatCommitmentChoicesTabTitle(this.effectiveCommitmentOptions);
  }

  /** Powers tab: committed pool amounts per length. */
  get tabPoolCommittedDisplay() {
    return formatPoolCommittedTab(this.poolCommitted);
  }

  /** Powers tab: compact committed amounts (e.g. "5 / 3"). */
  get tabPoolCommittedCompact() {
    return formatPoolCommittedTabCompact(this.poolCommitted);
  }

  /** Powers tab: multiline committed tooltip. */
  get tabPoolCommittedTooltip() {
    return formatPoolCommittedTabTooltip(this.poolCommitted);
  }

  get displayTypeName() {
    if (this.subType === "custom") {
      const name = (this.customTypeName ?? "").trim();
      return name || game.i18n.localize("WWN.PowerSubType.custom");
    }
    const key = CONFIG.WWN.powerSubtypes[this.subType]?.label;
    return key ? game.i18n.localize(key) : this.subType;
  }

  /**
   * Coerce invalid stored enum values so documents load. Not a migration step —
   * see module/migration/ for WWN → WWN and versioned world migration.
   * @inheritdoc
   */
  static _cleanData(data, options, _state) {
    if (
      data?.internalResourceLength !== undefined
      && data.internalResourceLength !== "scene"
      && data.internalResourceLength !== "day"
    ) {
      data.internalResourceLength = normalizeInternalResourceLength(data.internalResourceLength);
    }
  }

  /** Subtype preset defaults. */
  get subtypeDefaults() {
    return CONFIG.WWN.powerSubtypes[this.subType]?.defaults ?? {};
  }
}

import { personas } from "../data/mock";

const COACH_IMG = {
  Soft: "/Healer.png",
  Normal: "/Secretary.png",
  Harsh: "/Elite.png",
};

/** Built-in coach avatar from profile key. */
export function profileAvatar(profile) {
  if (!profile) return COACH_IMG.Normal;
  const key = profile.key ?? profile.profileKey;
  if (key && COACH_IMG[key]) return COACH_IMG[key];
  return COACH_IMG.Normal;
}

/** User bubble avatar — same image as sidebar profile (nag persona). */
export function userAvatarFromAuth(user) {
  const key = user?.nagProfileKey ?? user?.aiTone ?? "Normal";
  const persona = personas.find((p) => p.key === key) ?? personas[1];
  return persona.profile;
}

export function profileFromPersona(p) {
  const persona = personas.find((x) => x.key === p?.key) ?? personas[1];
  return { ...p, color: p?.color ?? persona.color, face: persona.face };
}

export { COACH_IMG };

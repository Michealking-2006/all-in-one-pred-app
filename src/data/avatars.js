export const avatars = [
  { id: "messi", label: "Messi", src: "/src/assets/avatars/messi-avatar.png" },
  { id: "ronaldo", label: "Ronaldo", src: "/src/assets/avatars/ronaldo-avatar.png" },
  { id: "kane", label: "Harry Kane", src: "/src/assets/avatars/harry-kane-avatar.png" },
  { id: "mbappe", label: "Mbapp\u00e9", src: "/src/assets/avatars/mbappe-avatar.png" },
  { id: "woman", label: "Avatar", src: "/src/assets/avatars/woman-avatar.png" },
];

export function getAvatarSrc(avatarId) {
  return avatars.find((a) => a.id === avatarId)?.src || null;
}

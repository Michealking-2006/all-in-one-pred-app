export const avatars = [
  { id: "messi", label: "Messi", src: "/src/assets/avatars/messi-avatar.webp" },
  { id: "ronaldo", label: "Ronaldo", src: "/src/assets/avatars/ronaldo-avatar.webp" },
  { id: "kane", label: "Harry Kane", src: "/src/assets/avatars/harry-kane-avatar.webp" },
  { id: "mbappe", label: "Mbapp\u00e9", src: "/src/assets/avatars/mbappe-avatar.webp" },
  { id: "woman", label: "Avatar", src: "/src/assets/avatars/woman-avatar.webp" },
];

export function getAvatarSrc(avatarId) {
  return avatars.find((a) => a.id === avatarId)?.src || null;
}

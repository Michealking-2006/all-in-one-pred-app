async function loadOverviewProfileImage() {
  const profileElement = document.querySelector(".user-profile-img");
  if (!profileElement) return;

  const supabase = window.supabaseClient || window.supabase;
  if (!supabase) return;

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user?.id) return;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Failed to load overview profile image:", profileError);
      return;
    }

    const avatarUrl = profile?.avatar_url;
    if (!avatarUrl) return;

    const icon = profileElement.querySelector(".icon");
    if (!icon) return;

    const image = document.createElement("img");
    image.className = "icon";
    image.src = avatarUrl;
    image.alt = "Profile";
    image.loading = "lazy";
    image.decoding = "async";
    image.onerror = () => {
      image.remove();
      icon.style.display = "";
    };

    icon.replaceWith(image);
  } catch (error) {
    console.error("Overview profile image error:", error);
  }
}

loadOverviewProfileImage();

(() => {
  if (window.__overviewSearchLoaderInstalled) return;
  window.__overviewSearchLoaderInstalled = true;

  const loadSearch = () => {
    if (window.__overviewSearchLoaded) return;
    window.__overviewSearchLoaded = true;

    const script = document.createElement("script");
    script.src = "/assets/js/ui/overview-search.js";
    script.async = true;
    script.dataset.overviewSearch = "true";
    document.head.appendChild(script);
  };

  loadSearch();
})();

async function loadOverviewProfileImage() {
  const profileContainer = document.querySelector(".user-profile-img");
  
  if (!profileContainer) return;
  
  try {
    const supabase = window.supabaseClient;
    
    if (!supabase) return;
    
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser();
    
    if (authError || !user) return;
    
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", user.id)
      .maybeSingle();
    
    if (profileError) {
      console.error("Failed to load profile image:", profileError);
      return;
    }
    
    const avatarUrl =
      profile?.avatar_url || "/assets/icons/normal-pfp.jpeg";
    
    profileContainer.querySelector(".icon")?.remove();
    
    let profileImage = profileContainer.querySelector(".profile-avatar");
    
    if (!profileImage) {
      profileImage = document.createElement("img");
      profileImage.className = "profile-avatar";
      profileImage.alt = "Profile";
      profileContainer.appendChild(profileImage);
    }
    
    profileImage.src = avatarUrl;
    
  } catch (error) {
    console.error("Failed to load overview profile image:", error);
  }
}
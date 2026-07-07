const { createElement: h, useEffect, useState, useRef } = React;
const { createRoot } = ReactDOM;

const API_BASE = resolveApiBase();
const ANALYTICS_ENDPOINT = `${API_BASE}/api/quittr/analytics`;
const RELAPSE_ENDPOINT = `${API_BASE}/api/quittr/relapses`;
const URGE_LOG_ENDPOINT = `${API_BASE}/api/quittr/urges`;
const JOURNAL_ENDPOINT = `${API_BASE}/api/quittr/journal`;
const REASONS_ENDPOINT = `${API_BASE}/api/quittr/reasons`;
const MELIUS_CHAT_ENDPOINT = `${API_BASE}/api/melius/chat`;
const BLOCKER_STATE_ENDPOINT = `${API_BASE}/api/blocker/state`;
const BLOCKER_PROTECTION_ENDPOINT = `${API_BASE}/api/blocker/protection`;
const BLOCKER_TIER1_ENDPOINT = `${API_BASE}/api/blocker/tier1`;
const BLOCKER_WEBSITES_ENDPOINT = `${API_BASE}/api/blocker/websites`;
const BLOCKER_WEBSITES_REMOVE_ENDPOINT = `${API_BASE}/api/blocker/websites/remove`;
const BLOCKER_TIER2_ENDPOINT = `${API_BASE}/api/blocker/tier2`;
const BLOCKER_APPS_ENDPOINT = `${API_BASE}/api/blocker/apps`;
const BLOCKER_APPS_REMOVE_ENDPOINT = `${API_BASE}/api/blocker/apps/remove`;
const BLOCKER_TIER3_ENDPOINT = `${API_BASE}/api/blocker/tier3`;
const BLOCKER_TIER3_UNLOCK_ENDPOINT = `${API_BASE}/api/blocker/tier3/unlock`;
const BLOCKER_SCREENTIME_ENDPOINT = `${API_BASE}/api/blocker/screentime`;
const COMMUNITY_POSTS_ENDPOINT = `${API_BASE}/api/community/posts`;
const COMMUNITY_POST_ENDPOINT = `${API_BASE}/api/community/post`;
const COMMUNITY_COMMENT_ENDPOINT = `${API_BASE}/api/community/comment`;
const COMMUNITY_LIKE_ENDPOINT = `${API_BASE}/api/community/like`;

function resolveApiBase() {
  const { hostname, port, protocol } = window.location;
  const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";

  if (isLocalHost && port && port !== "3000") {
    return `${protocol}//127.0.0.1:3000`;
  }

  return "";
}

const milestoneNames = [
  "Sprout", "Ember", "Kindle", "Pioneer", "Spark", "Momentum", "Anchor", "Clarity", "Shield", "Fortress",
  "Steady", "Lift", "Resolve", "Guardian", "Focus", "Bright", "Rooted", "Calm", "Brave", "Signal",
  "Summit", "Northstar", "Balance", "Pulse", "Bloom", "Drift", "Beacon", "Mettle", "Horizon", "Prime"
];

const milestonePalettes = [
  ["rgba(132, 231, 181, 0.96)", "rgba(25, 144, 92, 0.82)", "rgba(12, 54, 42, 0.72)", "rgba(76, 245, 160, 0.62)"],
  ["rgba(250, 184, 80, 0.96)", "rgba(205, 75, 39, 0.84)", "rgba(62, 28, 20, 0.72)", "rgba(255, 177, 74, 0.64)"],
  ["rgba(224, 96, 164, 0.94)", "rgba(104, 56, 129, 0.84)", "rgba(33, 25, 45, 0.72)", "rgba(255, 112, 191, 0.58)"],
  ["rgba(77, 181, 235, 0.95)", "rgba(49, 96, 202, 0.82)", "rgba(23, 35, 72, 0.72)", "rgba(86, 201, 255, 0.58)"],
  ["rgba(132, 255, 67, 0.98)", "rgba(38, 188, 21, 0.9)", "rgba(8, 72, 18, 0.78)", "rgba(126, 255, 84, 0.7)"],
  ["rgba(177, 119, 255, 0.94)", "rgba(96, 62, 174, 0.84)", "rgba(35, 29, 63, 0.72)", "rgba(184, 121, 255, 0.62)"],
  ["rgba(255, 215, 80, 0.96)", "rgba(194, 130, 30, 0.84)", "rgba(66, 46, 20, 0.72)", "rgba(255, 220, 92, 0.62)"],
  ["rgba(99, 225, 213, 0.94)", "rgba(40, 137, 147, 0.84)", "rgba(18, 52, 61, 0.72)", "rgba(92, 240, 225, 0.58)"],
  ["rgba(238, 241, 232, 0.88)", "rgba(103, 117, 116, 0.78)", "rgba(31, 38, 39, 0.72)", "rgba(230, 255, 246, 0.48)"]
];

const fallbackStats = [
  { label: "Goal", value: "7d", icon: "diamond" },
  { label: "Streak", value: "3h 55m", icon: "streak" },
  { label: "Til Sober", value: "90d", icon: "bars" }
];

const quickActions = [
  { label: "Pledge Now", icon: "hand", active: true, action: "pledge" },
  { label: "Melius", icon: "melius", action: "melius" },
  { label: "Urge", icon: "bolt", action: "urge" },
  { label: "Reset", icon: "undo", action: "reset" }
];

const cards = [
  { title: "Rewire by Quittr", subtitle: "1:1 Help from Professionals", icon: "brain", accent: "green", action: "rewire" },
  { title: "Journal", subtitle: "Take a moment to reflect on your journey.", heading: "How are you feeling?", icon: "journal", badge: "1", buttonLabel: "New Entry", accent: "plain", action: "journal" },
  { title: "Reasons For Quitting", subtitle: "Click here to add a reason why you're quitting", icon: "note", accent: "plain", action: "reasons" },
  { title: "Content Blocker", subtitle: "Tap to learn more", icon: "block", accent: "red", pill: "Upgrade", action: "blocker" },
  { title: "Therapy", subtitle: "Get support from a licensed therapist via BetterHelp.", icon: "therapy", accent: "violet", action: "therapy" }
];

const pledgeBenefits = [
  { title: "Achievable Goal", description: "When pledging, you agree to not relapse for the day only.", icon: "check-circle", tone: "green" },
  { title: "Take it Easy", description: "If you relapse, your streak won't reset. Just get back on track and change your mind tomorrow.", icon: "sparkles", tone: "violet" },
  { title: "Success is Inevitable", description: "Stay strong, the first few days/weeks will be tough but after that it'll get easier.", icon: "crown", tone: "gold" }
];

const libraryShortcuts = [
  { label: "Melius", icon: "melius", action: "melius" },
  { label: "Meditate", icon: "meditate", action: "meditate" },
  { label: "Lifetree", icon: "tree", action: "lifetree" },
  { label: "Learn", icon: "folder", action: "course" }
];

const soundscapes = [
  { title: "Campfire", tone: "campfire", emoji: "\uD83D\uDD25", description: "Warm crackling fire" },
  { title: "Ocean", tone: "ocean", emoji: "\uD83C\uDF0A", description: "Gentle ocean waves" },
  { title: "Rain", tone: "rain", emoji: "\uD83C\uDF27\uFE0F", description: "Steady rainfall" },
  { title: "Forest", tone: "forest", emoji: "\uD83C\uDF32", description: "Peaceful woodland" }
];

const lessons = [
  { title: "The Neuroscience of Porn Addictio...", status: "Completed", tone: "completed", icon: "check-circle" },
  { title: "Debunking Common Myths A...", status: "Continue learning", tone: "current", icon: "dot" },
  { title: "Psychological and Environmental F...", status: "Locked", tone: "locked", icon: "lock" }
];

const courseData = {
  title: "QUITTR's Guide to Recovery",
  tag: "QUITTR \u2022 Science-Backed",
  chapters: [
    {
      id: "ch1", title: "Understanding Addiction",
      lessons: [
        { id: "ch1-l1", title: "The Neuroscience of Porn Addiction\u2014How It Hijacks the Brain", duration: "1 min", status: "completed",
          sections: [
            { heading: "Introduction", body: "Porn addiction is not a moral failing\u2014it is a neurobiological process. When a person repeatedly views pornography, the brain\u2019s reward system (specifically the mesolimbic dopamine pathway) is activated in a way that mirrors substance addiction. Over time, the brain begins to depend on this hyper-stimulation for pleasure, and everyday experiences feel muted by comparison." },
            { heading: "The Dopamine Hijack", body: "Dopamine is the brain\u2019s \u201Cwanting\u201D chemical. During porn consumption, dopamine floods the nucleus accumbens at levels far exceeding what natural rewards (food, social connection, exercise) can produce. With repeated exposure, dopamine receptors down-regulate\u2014meaning more extreme or novel content is needed to achieve the same arousal. This is the same tolerance mechanism seen in cocaine and opioid addiction (Koob & Le Moal, 2008)." },
            { heading: "Prefrontal Cortex Impairment", body: "The prefrontal cortex (PFC) governs impulse control, future planning, and moral reasoning. Neuroimaging studies show that compulsive porn users exhibit reduced gray matter volume and decreased activity in the PFC (K\u00FChn & Gallinat, 2014). This means the brain\u2019s \u201Cbrake system\u201D is weakened, making it harder to resist urges even when you consciously want to stop." },
            { heading: "The Habit Loop", body: "Addiction follows a three-part loop: Cue (boredom, stress, loneliness) \u2192 Routine (viewing porn) \u2192 Reward (dopamine release). Over time, this loop becomes automatic, encoded in the basal ganglia. Understanding this loop is the first step toward breaking it\u2014because you cannot change what you do not understand." }
          ],
          reflection: "Think about the last time you felt a strong urge. What was the cue? Were you stressed, bored, or lonely? Identifying your most common trigger is the first step in rewiring the habit loop."
        },
        { id: "ch1-l2", title: "Debunking Common Myths About Porn Addiction", duration: "1 min", status: "completed",
          sections: [
            { heading: "Myth #1: \u201CIt\u2019s not addiction if I can stop anytime.\u201D", body: "Neuroscientific evidence confirms that repeated exposure to high-stimulation porn activates the brain\u2019s reward circuit, leading to tolerance and withdrawal symptoms\u2014key markers of addiction. The ability to \u201Cstop anytime\u201D often reflects denial or lack of awareness, not genuine control. Studies show compulsive porn users exhibit brain patterns similar to those with substance use disorders (Voon et al., 2014)." },
            { heading: "Myth #2: \u201CIt\u2019s harmless because it\u2019s not a substance.\u201D", body: "Behavioral addictions can be just as powerful as substance addictions. The brain does not distinguish between a chemical dopamine trigger and a visual one\u2014both activate the same neural pathways. Research in the Journal of Behavioral Addictions found that compulsive porn users show identical patterns of craving, tolerance, and withdrawal as gambling addicts (Brand et al., 2016)." },
            { heading: "Myth #3: \u201CEveryone watches it, so it must be normal.\u201D", body: "Prevalence does not equal harmlessness. While consumption is widespread, compulsive use\u2014characterized by loss of control, escalation, and continued use despite negative consequences\u2014affects an estimated 3\u20136% of users (Reid et al., 2020). Normalizing the behavior can prevent people from recognizing when it has become a problem." },
            { heading: "Myth #4: \u201CMy partner won\u2019t notice\u2014I\u2019m still faithful.\u201D", body: "Even without physical infidelity, emotional disconnection, secrecy, and loss of intimacy are common consequences. A 2021 study in the Journal of Sex & Marital Therapy found that couples where one partner engaged in regular porn use reported significantly lower relationship satisfaction and higher conflict frequency." }
          ],
          reflection: "If you\u2019re questioning whether your viewing habits are problematic, ask yourself: Do I feel shame afterward? Do I hide my usage? Does it interfere with responsibilities or relationships? Two or more \u201Cyes\u201D answers suggest it\u2019s time to explore change."
        },
        { id: "ch1-l3", title: "Psychological and Environmental Factors Contributing to Porn Addiction", duration: "1 min", status: "completed",
          sections: [
            { heading: "Psychological Vulnerabilities", body: "Porn addiction rarely exists in isolation. Research shows that over 70% of individuals seeking treatment also report symptoms of anxiety, depression, ADHD, PTSD, or social anxiety (APA, 2022). Porn often serves as a coping mechanism\u2014a way to numb emotional pain, escape stress, or fill a void of loneliness." },
            { heading: "Childhood and Adolescent Exposure", body: "Early exposure to pornography (before age 14) is associated with higher rates of compulsive use in adulthood. The adolescent brain is in a critical period of synaptic pruning\u2014neural pathways formed during this time become deeply ingrained. Early exposure essentially \u201Cteaches\u201D the developing brain that sexual arousal is linked to screen-based stimulation." },
            { heading: "Environmental Triggers", body: "Unrestricted internet access, lack of accountability, social isolation, and high-stress environments all increase vulnerability. The \u201CTriple-A Engine\u201D (Accessibility, Affordability, Anonymity) makes porn uniquely addictive compared to previous eras. Environmental design\u2014such as keeping devices out of the bedroom\u2014can significantly reduce compulsive use." },
            { heading: "Attachment and Connection", body: "Attachment theory suggests that insecure attachment styles (anxious or avoidant) increase addiction risk. People who struggle with emotional intimacy may turn to porn as a \u201Csafe\u201D substitute for real connection. Building secure relationships\u2014with friends, partners, or support groups\u2014is a powerful protective factor." }
          ],
          reflection: "Consider your environment: Are there spaces or times where you\u2019re most vulnerable? What one change could you make today to reduce exposure\u2014like charging your phone outside the bedroom?"
        },
        { id: "ch1-l4", title: "The Porn Addiction Cycle\u2014Recognizing Triggers and Patterns", duration: "1 min", status: "completed",
          sections: [
            { heading: "The Cycle of Compulsive Use", body: "The addiction cycle follows a predictable pattern: Emotional Trigger (stress, boredom, rejection) \u2192 Fantasy and Anticipation \u2192 Ritualized Searching \u2192 Consumption \u2192 Temporary Relief \u2192 Shame and Guilt \u2192 Return to Trigger. This cycle can repeat daily or multiple times per day, each iteration strengthening the neural pathway." },
            { heading: "Identifying Your Triggers", body: "Common triggers include: HALT states (Hungry, Angry, Lonely, Tired), unstructured time, social media exposure, relationship conflict, and work stress. Keeping a trigger journal\u2014recording the time, emotion, and context of each urge\u2014helps you identify patterns and develop targeted coping strategies." },
            { heading: "The Role of Shame", body: "Shame is both a consequence and a fuel of addiction. After consumption, shame activates the same stress pathways that triggered the behavior initially\u2014creating a self-perpetuating loop. Breaking this cycle requires self-compassion, not self-punishment. Research by Dr. Kristin Neff shows that self-compassion practices reduce shame-driven behaviors by 40% (Neff, 2011)." },
            { heading: "Breaking the Pattern", body: "Evidence-based strategies include: (1) The 10-Minute Rule\u2014delay acting on the urge for 10 minutes, during which the intensity typically drops by 50%. (2) Environment Shift\u2014physically move to a different room or go outside. (3) Replacement Behavior\u2014engage in a pre-planned activity (push-ups, cold water on face, calling a friend)." }
          ],
          reflection: "For the next 3 days, try keeping a simple trigger log. Each time you feel an urge, write down: Time, Emotion, Location, and What happened before. Patterns will emerge that give you power over the cycle."
        },
        { id: "ch1-l5", title: "The Impact of Stigma on Porn Addiction and Recovery", duration: "1 min", status: "completed",
          sections: [
            { heading: "The Weight of Stigma", body: "Porn addiction carries a unique double stigma: the shame of addiction combined with the taboo nature of sexual behavior. This stigma prevents many people from seeking help\u2014research shows that individuals with sexual compulsions are 3x less likely to seek professional support than those with other addictions (Lewer et al., 2019)." },
            { heading: "Internalized Shame vs. Guilt", body: "Guilt says \u201CI did something bad.\u201D Shame says \u201CI am bad.\u201D Guilt can motivate change; shame paralyzes it. Studies consistently show that shame-based self-talk increases relapse rates, while self-compassion and cognitive reframing improve recovery outcomes. The language you use with yourself matters enormously." },
            { heading: "Breaking the Silence", body: "Recovery begins in community. Sharing your struggle\u2014with a therapist, support group, or trusted person\u2014reduces the power of stigma. Anonymous support groups (online or in-person) provide a judgment-free space. Research shows that group-based interventions reduce shame by 55% and improve sustained recovery by 40% (Hook et al., 2021)." },
            { heading: "Reframing the Narrative", body: "Addiction is not a character flaw\u2014it is a learned behavior driven by neurobiology, environment, and unmet needs. Recovery is not about willpower alone; it requires systems, support, and self-understanding. Every person who recovers is proof that the brain can heal and that change is possible." }
          ],
          reflection: "Write a letter to yourself from the perspective of a compassionate friend. What would they say about your struggle? How would they describe your courage in seeking change? Keep this letter for difficult moments."
        }
      ]
    },
    {
      id: "ch2", title: "Health Effects",
      lessons: [
        { id: "ch2-l1", title: "Physical Health Consequences of Porn Addiction", duration: "1 min", status: "completed",
          sections: [
            { heading: "Introduction", body: "Porn addiction is often perceived as a purely psychological issue, but it can have significant physical health consequences. Understanding these effects is crucial for recognizing the seriousness of the addiction and motivating steps toward recovery." },
            { heading: "Sexual Dysfunction", body: "One of the most direct physical impacts is sexual dysfunction, particularly in men. This manifests as: Erectile Dysfunction (ED)\u2014chronic consumption desensitizes the brain\u2019s response to sexual stimuli, making it difficult to achieve or maintain an erection with a real-life partner. Delayed Ejaculation\u2014overstimulation leads to difficulties reaching orgasm during physical intimacy. Decreased Sex Drive\u2014overreliance on pornography reduces interest in actual sexual encounters." },
            { heading: "Desensitization and Tolerance", body: "Repeated exposure to high-intensity sexual content leads to desensitization. Over time, more extreme or novel content is needed to achieve the same level of arousal. This escalation can alter sexual preferences\u2014individuals may develop preferences that do not align with their real-life desires or values. It also reduces sensitivity to physical touch\u2014real-life intimacy may feel less satisfying compared to exaggerated scenarios." },
            { heading: "Sleep Disruption and Fatigue", body: "Late-night porn consumption disrupts circadian rhythms and reduces sleep quality. Blue light from screens suppresses melatonin production, while the dopamine surge makes it difficult to fall asleep. Chronic sleep deprivation compounds every other health issue\u2014weakening immunity, impairing cognition, and increasing depression risk." }
          ],
          reflection: "Notice how your body feels after extended screen time. Are you sleeping well? Do you feel physically energized? Your body is sending signals\u2014learning to listen to them is a key part of recovery."
        },
        { id: "ch2-l2", title: "Mental Health and Emotional Well-being Impact", duration: "1 min", status: "current",
          sections: [
            { heading: "The Depression-Anxiety Cycle", body: "Compulsive porn use is strongly correlated with depression and anxiety. A meta-analysis of 27 studies found that problematic porn users were 2.3x more likely to report clinical depression (Wright et al., 2021). The mechanism involves dopamine depletion (reducing motivation and pleasure), shame-driven isolation, and the loss of natural reward sensitivity." },
            { heading: "Cognitive Effects", body: "Regular compulsive porn use impairs executive function\u2014the brain\u2019s ability to focus, plan, make decisions, and regulate emotions. fMRI studies show reduced connectivity between the prefrontal cortex and the limbic system in compulsive users, making it harder to \u201Cthink clearly\u201D under stress (Brand et al., 2016). Many users report brain fog, poor concentration, and decreased productivity." },
            { heading: "Emotional Numbing", body: "Over time, the constant dopamine spikes and crashes lead to emotional blunting\u2014a reduced ability to feel joy, excitement, or deep connection. This is not permanent. With sustained recovery, emotional sensitivity gradually returns, often within 4\u20138 weeks. Users frequently report that colors seem brighter, music sounds better, and relationships feel more meaningful." },
            { heading: "Social Anxiety and Isolation", body: "Shame and secrecy drive social withdrawal. As porn use increases, people often reduce social activities, avoid intimate relationships, and become increasingly isolated. This isolation then fuels further compulsive use\u2014creating a self-reinforcing cycle. Breaking isolation through even small social connections is a powerful recovery tool." }
          ],
          reflection: "Rate your current mood, energy, and focus on a scale of 1\u201310. Track these daily for a week. Many people notice that their ratings improve as they reduce compulsive behaviors\u2014visible proof that the brain is healing."
        },
        { id: "ch2-l3", title: "Effects on Relationships and Intimacy", duration: "1 min", status: "locked",
          sections: [
            { heading: "The Intimacy Paradox", body: "Porn addiction creates a paradox: the more a person consumes, the less capable they become of genuine intimacy. The brain becomes conditioned to respond to pixels on a screen rather than the complex, imperfect reality of human connection. Partners often sense the emotional withdrawal even without knowing the cause." },
            { heading: "Trust and Transparency", body: "Secrecy erodes trust\u2014the foundation of every relationship. Research shows that when a partner discovers compulsive porn use, the emotional impact mirrors the betrayal trauma of physical infidelity (Steffens & Means, 2009). Rebuilding trust requires radical transparency, consistent behavior change, and often professional couples counseling." },
            { heading: "Sexual Compatibility Issues", body: "Compulsive porn use can create unrealistic expectations about sexual performance, body image, and frequency. These expectations can lead to dissatisfaction with real partners, performance anxiety, and avoidance of physical intimacy. Recovery often involves \u201Crewiring\u201D sexual expectations to align with reality." },
            { heading: "Healing Together", body: "Couples who address porn addiction together\u2014through therapy, open communication, and shared goals\u2014often emerge with stronger relationships than before. The process of vulnerability, accountability, and mutual support builds deeper intimacy than existed previously. Programs like SASH (Society for the Advancement of Sexual Health) offer specialized couples resources." }
          ],
          reflection: "If you\u2019re in a relationship, consider: How has your behavior affected your emotional availability? What one step could you take toward greater honesty\u2014whether with your partner, a therapist, or yourself?"
        },
        { id: "ch2-l4", title: "Impact on Productivity and Daily Life", duration: "1 min", status: "locked",
          sections: [
            { heading: "Time and Energy Drain", body: "Compulsive porn use consumes enormous amounts of time\u2014not just the act itself, but the mental energy of anticipation, searching, and post-consumption shame. Users report losing 1\u20133 hours per day to the cycle. This is time stolen from work, relationships, exercise, hobbies, and sleep." },
            { heading: "Workplace Consequences", body: "Decreased concentration, missed deadlines, and risky behavior (viewing at work) are common. A survey by the American Academy of Matrimonial Lawyers found that porn use was cited as evidence in 56% of divorce cases, and workplace viewing was a factor in many employment terminations." },
            { heading: "Motivation and Goal Pursuit", body: "Dopamine is the brain\u2019s motivation chemical. When it\u2019s chronically depleted by hyper-stimulation, pursuing long-term goals feels unrewarding. This is why many compulsive users report a loss of ambition, procrastination, and a sense of \u201Cstuckness.\u201D Recovery restores dopamine sensitivity\u2014and with it, the natural drive to pursue meaningful goals." },
            { heading: "Financial Impact", body: "Beyond direct costs (subscriptions, premium content), there are indirect costs: lost productivity, therapy expenses, relationship counseling, and in severe cases, legal fees. Recognizing the full financial impact can be a powerful motivator for change." }
          ],
          reflection: "For one week, track the time and energy spent on compulsive behaviors. Then imagine redirecting that energy toward one meaningful goal\u2014learning a skill, building a project, or investing in a relationship."
        },
        { id: "ch2-l5", title: "Long-term Neurological Changes", duration: "1 min", status: "locked",
          sections: [
            { heading: "Brain Structure Changes", body: "Chronic compulsive porn use is associated with measurable changes in brain structure: reduced gray matter in the prefrontal cortex (decision-making), altered white matter connectivity (communication between brain regions), and shrinkage of the nucleus accumbens (reward processing). These changes are visible on MRI scans and correlate with years of compulsive use." },
            { heading: "Epigenetic Effects", body: "Emerging research suggests that chronic addiction can alter gene expression through epigenetic mechanisms\u2014changes that don\u2019t modify DNA but affect how genes are \u201Cread.\u201D These changes can affect stress response, impulse control, and even be passed to offspring. The encouraging news: recovery can reverse many of these epigenetic marks." },
            { heading: "Memory and Learning Impairment", body: "The hippocampus\u2014critical for memory formation and learning\u2014is particularly vulnerable to chronic stress and dopamine dysregulation. Compulsive users often report forgetfulness, difficulty learning new information, and reduced cognitive flexibility. With sustained recovery, hippocampal neurogenesis (new neuron growth) resumes, improving memory within 6\u201312 weeks." },
            { heading: "The Good News: Neuroplasticity", body: "The brain\u2019s ability to heal is remarkable. Studies show that 90 days of sustained abstinence leads to measurable recovery of prefrontal cortex volume, improved dopamine receptor sensitivity, and restored white matter connectivity. The brain that was changed by addiction can be changed again\u2014this time by recovery." }
          ],
          reflection: "Your brain is not permanently broken. Every day of recovery is a day your brain heals. Visualize your neural pathways rewiring\u2014like a forest path that grows over when it\u2019s no longer walked."
        }
      ]
    },
    {
      id: "ch3", title: "Benefits of Quitting",
      lessons: [
        { id: "ch3-l1", title: "Mental Clarity and Emotional Freedom", duration: "1 min", status: "completed",
          sections: [
            { heading: "The Fog Lifts", body: "One of the most commonly reported benefits of quitting is mental clarity. Users describe the sensation of \u201Ca fog lifting\u201D\u2014suddenly they can think clearly, make decisions faster, and feel present in conversations. This typically begins within 2\u20133 weeks as dopamine receptors start to recalibrate." },
            { heading: "Emotional Range Returns", body: "Compulsive porn use blunts emotions\u2014both negative and positive. When you quit, the full spectrum of emotion gradually returns. Music sounds richer, nature looks more beautiful, and genuine human connection feels deeply rewarding. This emotional restoration is one of the most motivating aspects of sustained recovery." },
            { heading: "Reduced Anxiety", body: "As the brain\u2019s stress-response system normalizes, baseline anxiety levels drop significantly. Research shows a 35% reduction in generalized anxiety symptoms after 60 days of abstinence (B\u00F6the et al., 2021). The constant background tension of secrecy and shame also dissipates, replaced by a sense of integrity and self-respect." },
            { heading: "Increased Self-Esteem", body: "Every day of recovery is evidence of personal strength. This builds genuine self-efficacy\u2014the belief that you can handle difficult things. Self-esteem shifts from being externally dependent (on validation, consumption) to internally grounded (on values, discipline, growth)." }
          ],
          reflection: "Imagine yourself 30 days from now\u2014clearer mind, steadier emotions, deeper connections. What does that version of you look like? What would they say to you right now?"
        },
        { id: "ch3-l2", title: "Improved Physical Health and Vitality", duration: "1 min", status: "current",
          sections: [
            { heading: "Energy Restoration", body: "Quitting porn often leads to a significant boost in physical energy. The time previously consumed by the addiction cycle (1\u20133 hours daily) is reclaimed for exercise, sleep, and productive activities. Combined with improved sleep quality, users report feeling more vital and physically capable within weeks." },
            { heading: "Hormonal Rebalancing", body: "Chronic porn use can disrupt hormonal balance, particularly testosterone and cortisol patterns. Studies suggest that 7 days of abstinence from ejaculation can increase testosterone levels by up to 45% (Jiang et al., 2003). While the direct effects are debated, many users report increased confidence, drive, and physical presence." },
            { heading: "Better Sleep", body: "Removing late-night screen time and dopamine stimulation dramatically improves sleep quality. Deep sleep increases, leading to better physical recovery, immune function, and cognitive performance. Users often report falling asleep faster and waking more refreshed." },
            { heading: "Physical Confidence", body: "As sexual dysfunction improves (typically within 4\u20138 weeks), physical confidence returns. The combination of better erections, increased sensitivity, and restored natural arousal patterns contributes to overall physical well-being and self-assurance." }
          ],
          reflection: "What could you do with an extra hour each day? List three physical activities that excite you\u2014running, martial arts, dancing, hiking\u2014and commit to trying one this week."
        },
        { id: "ch3-l3", title: "Rebuilding Healthy Relationships", duration: "1 min", status: "locked",
          sections: [
            { heading: "Presence and Availability", body: "When you\u2019re no longer mentally preoccupied with the addiction cycle, you become truly present for the people in your life. Conversations deepen, eye contact becomes natural, and emotional availability increases. Partners, friends, and family notice the change\u2014often before you do." },
            { heading: "Authentic Intimacy", body: "Recovery allows genuine intimacy to develop\u2014built on vulnerability, trust, and mutual respect rather than performance or fantasy. This applies to romantic relationships and all human connections. Many people in recovery report forming their deepest friendships during this period." },
            { heading: "Communication Skills", body: "The practice of honest self-reflection and accountability (core to recovery) naturally improves communication skills. You become better at expressing needs, listening actively, and navigating conflict without avoidance or emotional shutdown." },
            { heading: "Attraction and Romance", body: "As confidence, energy, and emotional availability increase, many people find that their romantic lives improve dramatically. The ability to be genuinely attracted to a real partner\u2014rather than a screen\u2014is one of the most rewarding aspects of sustained recovery." }
          ],
          reflection: "Think of one relationship in your life that matters most. What would change if you were fully present and emotionally available? Take one small step toward that today\u2014a genuine conversation, a shared activity, or simply undivided attention."
        },
        { id: "ch3-l4", title: "Increased Confidence and Self-Esteem", duration: "1 min", status: "locked",
          sections: [
            { heading: "The Confidence-Competence Loop", body: "Every challenge you face in recovery builds competence\u2014and competence builds confidence. Each urge resisted, each trigger managed, each day completed strengthens the belief that you are capable. This confidence generalizes beyond recovery into work, relationships, and personal goals." },
            { heading: "Values Alignment", body: "Addiction creates a gap between your values and your behavior\u2014and that gap generates shame. Recovery closes the gap. When your actions align with your values, self-respect naturally follows. You no longer need to \u201Chide\u201D from yourself." },
            { heading: "Social Confidence", body: "Without the weight of secrecy, social interactions become lighter and more authentic. Many recovering individuals report improved eye contact, reduced social anxiety, and a natural ability to connect with others. This is partly neurological (restored dopamine function) and partly psychological (reduced shame)." },
            { heading: "Identity Reconstruction", body: "Addiction narrows identity\u2014you become \u201Csomeone who has this problem.\u201D Recovery expands identity\u2014you become someone who overcame, who grew, who chose differently. This expanded identity is more resilient and more attractive to others." }
          ],
          reflection: "Complete this sentence: \u201CI am the kind of person who...\u201D Write three versions\u2014one about your character, one about your goals, one about your relationships. These are the foundations of your new identity."
        },
        { id: "ch3-l5", title: "Rediscovering Purpose and Meaning", duration: "1 min", status: "locked",
          sections: [
            { heading: "Beyond Abstinence", body: "Recovery is not just about stopping a behavior\u2014it\u2019s about building a life worth living. Purpose provides the \u201Cwhy\u201D that sustains the \u201Chow.\u201D Research shows that individuals with a clear sense of purpose are 3x more likely to maintain long-term recovery (Hill et al., 2018)." },
            { heading: "Post-Traumatic Growth", body: "Many people discover that their struggle with addiction becomes a catalyst for profound personal growth. They develop empathy, resilience, self-awareness, and compassion that they might not have cultivated otherwise. This is called post-traumatic growth\u2014and it\u2019s a well-documented phenomenon in psychology." },
            { heading: "Contribution and Service", body: "One of the most powerful aspects of recovery is the ability to help others. Sharing your experience\u2014in support groups, online communities, or mentoring\u2014reinforces your own recovery while giving your journey meaning. Service transforms suffering into contribution." },
            { heading: "Building Your Vision", body: "What does a meaningful life look like for you? Not a life without urges or challenges, but one where you\u2019re growing, connecting, and contributing. Recovery gives you the clarity and energy to pursue that vision\u2014one day at a time." }
          ],
          reflection: "Write your \u201Crecovery vision statement\u201D: In one year, my life will look like ___. I will be known for ___. I will have contributed ___. Post this somewhere you\u2019ll see it daily."
        }
      ]
    },
    {
      id: "ch4", title: "Recovery Strategies",
      lessons: [
        { id: "ch4-l1", title: "The Neurobiology of Recovery\u2014How the Brain Rebuilds", duration: "1 min", status: "completed",
          sections: [
            { heading: "Dopamine Reset", body: "Chronic porn use desensitizes dopamine receptors. During early recovery, dopamine sensitivity gradually returns over 3\u20136 weeks, reducing cravings and increasing reward responsiveness to natural stimuli (e.g., social connection, physical activity). The first two weeks are the hardest\u2014your brain is recalibrating. Expect irritability, boredom, and flat mood. These are signs of healing, not failure." },
            { heading: "Prefrontal Cortex Restoration", body: "Impulse control and decision-making rely on the prefrontal cortex, which is impaired during active addiction. With consistent abstinence and mindfulness practice, gray matter volume increases measurably within 8 weeks (K\u00FChn & Gallinat, 2014). Activities that strengthen the PFC include: meditation, learning new skills, strategic games (chess, puzzles), and deliberate cold exposure." },
            { heading: "Stress Response Regulation", body: "The amygdala becomes hyper-reactive in addiction\u2014everything feels more stressful and urgent. Recovery involves strengthening the hippocampus\u2019 ability to modulate fear and stress responses through breathwork, grounding techniques, and sleep hygiene. The 4-7-8 breathing technique (inhale 4s, hold 7s, exhale 8s) activates the parasympathetic nervous system within 60 seconds." },
            { heading: "The Timeline of Brain Healing", body: "Week 1\u20132: Acute withdrawal (irritability, strong cravings, poor sleep). Week 3\u20134: Dopamine begins to stabilize (mood improves, cravings become less frequent). Week 5\u20138: PFC function improves (better focus, impulse control). Week 9\u201312: Neural pathways significantly rewired (natural rewards feel satisfying again). Week 12+: Consolidation phase (new patterns become automatic)." }
          ],
          reflection: "What small, daily action can you take this week to support your brain\u2019s healing process? Example: 5 minutes of deep breathing before bed, or walking outside for 10 minutes without phone use."
        },
        { id: "ch4-l2", title: "Cognitive Behavioral Tools for Breaking the Cycle", duration: "1 min", status: "current",
          sections: [
            { heading: "Thought Records", body: "CBT\u2019s most powerful tool is the thought record. When an urge strikes, write down: (1) The Situation\u2014where are you, what happened? (2) The Automatic Thought\u2014what is your brain telling you? (3) The Emotion\u2014what are you feeling? (4) The Rational Response\u2014what would a wise friend say? (5) The Outcome\u2014how do you feel now? This process creates space between trigger and response." },
            { heading: "Cognitive Distortions", body: "Addiction thrives on distorted thinking. Common patterns include: All-or-Nothing (\u201CI already slipped, might as well go all the way\u201D), Minimization (\u201CJust one peek won\u2019t hurt\u201D), and Emotional Reasoning (\u201CI feel bad, so I deserve relief\u201D). Learning to identify and challenge these distortions weakens their power." },
            { heading: "Implementation Intentions", body: "Instead of vague willpower (\u201CI\u2019ll try to resist\u201D), create specific if-then plans: \u201CIf I feel the urge at night, then I will immediately do 20 push-ups and take a cold shower.\u201D Research by Peter Gollwitzer shows that implementation intentions increase follow-through by 2\u20133x compared to motivation alone (Gollwitzer, 1999)." },
            { heading: "Behavioral Experiments", body: "Test your beliefs through action. If you believe \u201CI can\u2019t sleep without it,\u201D run a 3-day experiment: no consumption before bed, and track sleep quality. Most people discover their fears are exaggerated\u2014and this evidence-based confidence grows with each successful experiment." }
          ],
          reflection: "Create three if-then plans for your most common triggers. Write them down and keep them accessible. Example: \u201CIf I feel bored and reach for my phone, then I will open my journal app instead and write for 2 minutes.\u201D"
        },
        { id: "ch4-l3", title: "Building a Relapse-Resistant Environment", duration: "1 min", status: "locked",
          sections: [
            { heading: "Digital Architecture", body: "Your digital environment should make the unwanted behavior difficult and the desired behavior easy. Install content blockers on all devices. Remove social media apps that serve as gateways. Use grayscale mode on your phone to reduce visual stimulation. Charge devices outside the bedroom. These are not crutches\u2014they are smart design." },
            { heading: "Physical Environment", body: "Your physical space should support recovery. Keep your bedroom for sleep only (no screens). Create a dedicated \u201Crecovery corner\u201D\u2014a comfortable space for journaling, reading, or meditation. Fill your environment with visual reminders of your goals (vision board, written reasons, progress tracker)." },
            { heading: "Time Architecture", body: "Unstructured time is the enemy of recovery. Plan your days with intention\u2014especially high-risk times (late evening, early morning, weekends). Use time-blocking to create structure. Schedule exercise, social activities, and creative pursuits during your most vulnerable hours." },
            { heading: "Social Architecture", body: "Surround yourself with people who support your recovery. Reduce contact with people or groups that normalize compulsive behavior. Join recovery communities (online or in-person). Consider an accountability partner\u2014someone you check in with daily. Research shows that social accountability increases success rates by 65% (Gollwitzer & Oettingen, 2015)." }
          ],
          reflection: "Audit your environment right now. List three things in your physical or digital space that make the unwanted behavior easier. Then list three changes you could make today to reverse that."
        },
        { id: "ch4-l4", title: "Support Systems and Accountability Partners", duration: "1 min", status: "locked",
          sections: [
            { heading: "Why Connection Heals", body: "Addiction thrives in isolation. Connection is the opposite of addiction\u2014not just abstinence, but belonging. Research consistently shows that social support is the single strongest predictor of sustained recovery, more powerful than willpower, therapy, or medication (Kelly et al., 2020)." },
            { heading: "Finding Your People", body: "Support can come from many sources: 12-step programs (SA, SAA), online communities (NoFap, YourBrainOnPorn forums), therapy groups, faith communities, or recovery apps (Brainbuddy, Covenant Eyes). The key is consistency\u2014regular contact with people who understand your struggle and celebrate your progress." },
            { heading: "Accountability Partners", body: "An accountability partner is someone you trust with your goals and check in with regularly. Effective accountability includes: daily check-ins (even brief), honest reporting of urges and slips, mutual encouragement, and shared strategies. Apps like Covenant Eyes or Accountable2You provide automated accountability through usage reports." },
            { heading: "Professional Support", body: "Therapy provides tools that peer support alone cannot. Certified Sex Addiction Therapists (CSAT) offer specialized treatment. Modalities include: CBT (cognitive restructuring), EMDR (for underlying trauma), ACT (acceptance and commitment therapy), and somatic therapy (body-based healing). If cost is a barrier, many therapists offer sliding scales, and some recovery organizations provide free counseling." }
          ],
          reflection: "Who is one person you could reach out to today\u2014a friend, therapist, or community member\u2014who could support your recovery? Taking the step to connect is an act of courage."
        },
        { id: "ch4-l5", title: "Creating Your Personal Recovery Blueprint", duration: "1 min", status: "locked",
          sections: [
            { heading: "Your Recovery Identity", body: "Sustainable recovery requires an identity shift\u2014from \u201Csomeone trying to stop\u201D to \u201Csomeone who lives differently.\u201D This is not about perfection; it\u2019s about direction. Every day you choose recovery, you reinforce this new identity. Ask yourself: Who do I want to become? What values do I want to embody?" },
            { heading: "The Daily Practice", body: "Recovery is built in daily micro-habits: Morning routine (meditation, journaling, exercise). Trigger management (awareness, environment, replacement). Evening wind-down (no screens 1 hour before bed, gratitude practice, reading). Weekly review (progress assessment, plan adjustment, connection with support). These practices compound over time." },
            { heading: "Handling Setbacks", body: "Relapse is not failure\u2014it\u2019s information. When a setback occurs: (1) Don\u2019t spiral into shame. (2) Analyze what happened\u2014what trigger, what thought pattern, what environmental factor? (3) Adjust your plan. (4) Reconnect with support immediately. (5) Restart your streak the same day, not tomorrow. Research shows that people who respond to setbacks with self-compassion and strategic adjustment recover faster than those who rely on willpower alone." },
            { heading: "Your Blueprint", body: "Combine everything you\u2019ve learned into a personal blueprint: Your why (reasons for quitting). Your triggers and coping strategies. Your support system. Your daily practices. Your vision for the future. Write this down. Review it weekly. Update it as you grow. This is your roadmap\u2014and it\u2019s uniquely yours." }
          ],
          reflection: "Take 10 minutes to draft your Personal Recovery Blueprint. Include: My top 3 reasons for change. My 3 biggest triggers and my plan for each. My daily non-negotiables. My support team. My 90-day vision. This document is your anchor."
        }
      ]
    }
  ]
};

const games = [
  { title: "Memory Recall", icon: "brain", tone: "memory" },
  { title: "Find It Fast", icon: "search", tone: "find" },
  { title: "Word Scramble", icon: "letters", tone: "words" }
];

const leaderboardRows = [
  { rank: 1, tone: "gold", width: "34%" },
  { rank: 2, tone: "silver", width: "31%" },
  { rank: 3, tone: "bronze", width: "27%" }
];

const profileBadges = [
  { label: "Starter badge", tone: "earned" },
  { label: "Locked badge", tone: "locked" },
  { label: "Locked badge", tone: "locked" },
  { label: "Locked badge", tone: "locked" },
  { label: "Locked badge", tone: "locked" },
  { label: "Locked badge", tone: "locked" },
  { label: "Locked badge", tone: "locked" }
];

const achievements = [
  { icon: "streak", tone: "ghost", count: "90" },
  { icon: "streak", tone: "ghost", count: "7" },
  { icon: "music", tone: "music" },
  { icon: "block", tone: "block" },
  { icon: "streak", tone: "ghost", count: "30" }
];

const resetActionOptions = [
  { icon: "chat", title: "Talk to Melius", subtitle: "Your AI recovery companion", action: "melius" },
  { icon: "journal", title: "Write it out", subtitle: "Capture your thoughts", action: "write" },
  { icon: "people", title: "Talk to someone", subtitle: "Reach out to the community", action: "community" },
  { icon: "breathe", title: "Take a breath", subtitle: "A quick breathing exercise", action: "breathe" }
];

const resetReflectionGroups = [
  {
    key: "emotions",
    title: "Emotion",
    subtitle: "What was present?",
    options: ["Numb", "Anxious", "Stressed", "Lonely", "Bored", "Ashamed"]
  },
  {
    key: "triggers",
    title: "Trigger",
    subtitle: "What opened the door?",
    options: ["Late night", "Being alone", "Social media", "Strong urge", "Conflict", "Tired"]
  },
  {
    key: "behaviors",
    title: "Behavior",
    subtitle: "What happened?",
    options: ["Scrolling", "Porn", "Fantasy", "Edging", "Masturbation", "Searching"]
  },
  {
    key: "thoughts",
    title: "Thought",
    subtitle: "What did your mind say?",
    options: ["Just once", "I already failed", "I deserve relief", "No one knows", "I cannot stop", "Start tomorrow"]
  }
];
const confettiPalette = ["#ffd84d", "#bc46ff", "#52df6c", "#ff5f7b", "#4db7ff", "#ffffff"];
const CALENDAR_DAY_MS = 24 * 60 * 60 * 1000;
const calendarWeekdays = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const confettiPieces = Array.from({ length: 26 }, (_, index) => ({
  x: `${-150 + ((index * 29) % 300)}px`,
  y: `${-320 - ((index * 31) % 260)}px`,
  delay: `${(index % 6) * 0.03}s`,
  duration: `${1.25 + (index % 4) * 0.14}s`,
  rotate: `${-200 + (index * 41) % 400}deg`,
  color: confettiPalette[index % confettiPalette.length],
  shape: index % 3 === 0 ? "dot" : index % 3 === 1 ? "strip" : "diamond"
}));

/* ---- Soundscape Audio Engine (Web Audio API) ---- */
function createNoiseBuffer(ctx, seconds, type) {
  const sr = ctx.sampleRate;
  const len = sr * seconds;
  const buf = ctx.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  if (type === "white") {
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  } else if (type === "pink") {
    let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
    for (let i = 0; i < len; i++) {
      const w = Math.random()*2-1;
      b0=0.99886*b0+w*0.0555179; b1=0.99332*b1+w*0.0750759;
      b2=0.969*b2+w*0.153852; b3=0.8665*b3+w*0.3104856;
      b4=0.55*b4+w*0.5329522; b5=-0.7616*b5-w*0.016898;
      d[i]=(b0+b1+b2+b3+b4+b5+b6+w*0.5362)*0.11; b6=w*0.115926;
    }
  } else {
    let last=0;
    for (let i = 0; i < len; i++) {
      const w=Math.random()*2-1;
      d[i]=(last+(0.02*w))/1.02; last=d[i]; d[i]*=3.5;
    }
  }
  return buf;
}

class SoundscapeEngine {
  constructor(type) {
    this.type=type; this.ctx=null; this.nodes=[]; this.masterGain=null;
    this.playing=false; this._intervals=[]; this._crackleTimer=null;
  }
  start() {
    if(this.playing)return;
    this.ctx=new(window.AudioContext||window.webkitAudioContext)();
    this.masterGain=this.ctx.createGain(); this.masterGain.gain.value=0.7;
    this.masterGain.connect(this.ctx.destination);
    ({campfire:()=>this._campfire(),ocean:()=>this._ocean(),rain:()=>this._rain(),forest:()=>this._forest()})[this.type]?.();
    this.playing=true;
  }
  stop() {
    this._intervals.forEach(clearInterval); this._intervals=[];
    if(this._crackleTimer){clearTimeout(this._crackleTimer);this._crackleTimer=null;}
    this.nodes.forEach(n=>{try{n.stop?.();n.disconnect?.();}catch(e){}}); this.nodes=[];
    if(this.ctx){this.ctx.close().catch(()=>{});this.ctx=null;}
    this.playing=false;
  }
  setVolume(v){if(this.masterGain)this.masterGain.gain.value=Math.max(0,Math.min(1,v));}
  _addNoise(type,freq,gain,q){
    const buf=createNoiseBuffer(this.ctx,4,type);
    const src=this.ctx.createBufferSource(); src.buffer=buf; src.loop=true;
    const f=this.ctx.createBiquadFilter(); f.type="lowpass"; f.frequency.value=freq; f.Q.value=q||1;
    const g=this.ctx.createGain(); g.gain.value=gain;
    src.connect(f); f.connect(g); g.connect(this.masterGain); src.start();
    this.nodes.push(src,f,g); return{src,filter:f,gain:g};
  }
  _campfire() {
    this._addNoise("brown",300,0.35);
    this._addNoise("white",2500,0.04);
    const crackle=()=>{
      if(!this.playing||!this.ctx)return;
      const dur=0.03+Math.random()*0.08;
      const buf=this.ctx.createBuffer(1,this.ctx.sampleRate*dur,this.ctx.sampleRate);
      const d=buf.getChannelData(0);
      for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.exp(-i/(d.length*0.25));
      const s=this.ctx.createBufferSource(); s.buffer=buf;
      const g=this.ctx.createGain(); g.gain.value=0.12+Math.random()*0.2;
      const f=this.ctx.createBiquadFilter(); f.type="bandpass"; f.frequency.value=800+Math.random()*2200; f.Q.value=2;
      s.connect(f); f.connect(g); g.connect(this.masterGain); s.start();
      s.onended=()=>{try{s.disconnect();f.disconnect();g.disconnect();}catch(e){}};
      this._crackleTimer=setTimeout(crackle,60+Math.random()*350);
    };
    crackle();
  }
  _ocean() {
    const n=this._addNoise("pink",500,0.35);
    const lfo=this.ctx.createOscillator(); lfo.type="sine"; lfo.frequency.value=0.1;
    const lg=this.ctx.createGain(); lg.gain.value=0.18;
    lfo.connect(lg); lg.connect(n.gain.gain); lfo.start(); this.nodes.push(lfo,lg);
    const lfo2=this.ctx.createOscillator(); lfo2.type="sine"; lfo2.frequency.value=0.065;
    const lg2=this.ctx.createGain(); lg2.gain.value=180;
    lfo2.connect(lg2); lg2.connect(n.filter.frequency); lfo2.start(); this.nodes.push(lfo2,lg2);
    this._addNoise("brown",120,0.12);
  }
  _rain() {
    this._addNoise("white",7000,0.22);
    const buf=createNoiseBuffer(this.ctx,4,"pink");
    const src=this.ctx.createBufferSource(); src.buffer=buf; src.loop=true;
    const f=this.ctx.createBiquadFilter(); f.type="highpass"; f.frequency.value=3500;
    const g=this.ctx.createGain(); g.gain.value=0.1;
    src.connect(f); f.connect(g); g.connect(this.masterGain); src.start();
    this.nodes.push(src,f,g);
    this._addNoise("brown",180,0.04);
  }
  _forest() {
    this._addNoise("pink",280,0.1);
    const lfo=this.ctx.createOscillator(); lfo.type="sine"; lfo.frequency.value=0.25;
    const lg=this.ctx.createGain(); lg.gain.value=40;
    const base=this.ctx.createBiquadFilter(); base.type="lowpass"; base.frequency.value=350;
    const buf=createNoiseBuffer(this.ctx,4,"pink");
    const src=this.ctx.createBufferSource(); src.buffer=buf; src.loop=true;
    const g=this.ctx.createGain(); g.gain.value=0.12;
    lfo.connect(lg); lg.connect(base.frequency);
    src.connect(base); base.connect(g); g.connect(this.masterGain);
    lfo.start(); src.start(); this.nodes.push(lfo,lg,base,src,g);
    const chirp=()=>{
      if(!this.playing||!this.ctx)return;
      const now=this.ctx.currentTime;
      const osc=this.ctx.createOscillator(); osc.type="sine";
      const baseFreq=1800+Math.random()*2800;
      osc.frequency.setValueAtTime(baseFreq,now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq*(1.15+Math.random()*0.5),now+0.07);
      osc.frequency.exponentialRampToValueAtTime(baseFreq*0.85,now+0.14);
      const cg=this.ctx.createGain();
      cg.gain.setValueAtTime(0,now);
      cg.gain.linearRampToValueAtTime(0.02+Math.random()*0.04,now+0.015);
      cg.gain.linearRampToValueAtTime(0,now+0.12+Math.random()*0.08);
      osc.connect(cg); cg.connect(this.masterGain); osc.start(now); osc.stop(now+0.25);
      osc.onended=()=>{try{osc.disconnect();cg.disconnect();}catch(e){}};
      setTimeout(chirp,1800+Math.random()*5500);
    };
    setTimeout(chirp,800+Math.random()*1800);
  }
}

function App() {
  const [page, setPage] = useState("home");
  const [activeTab, setActiveTab] = useState("overview");
  const [lastAction, setLastAction] = useState("");
  const [isPledgeOpen, setIsPledgeOpen] = useState(false);
  const [urgeFlow, setUrgeFlow] = useState(null);
  const [journalEntries, setJournalEntries] = useState([]);
  const [reasons, setReasons] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [clockNow, setClockNow] = useState(Date.now());
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [resetReview, setResetReview] = useState(createResetReview());
  const [selectedResetAction, setSelectedResetAction] = useState("");
  const [isRewireModalOpen, setIsRewireModalOpen] = useState(false);
  const [blockerState, setBlockerState] = useState(null);
  const [blockerSubview, setBlockerSubview] = useState("");
  const [communityPosts, setCommunityPosts] = useState([]);
  const [communityPostDetail, setCommunityPostDetail] = useState(null);
  const [communityFilter, setCommunityFilter] = useState("new");
  const [activeSoundscape, setActiveSoundscape] = useState(null);
  const [activeChapterIdx, setActiveChapterIdx] = useState(0);
  const [activeLesson, setActiveLesson] = useState(null);

  useEffect(() => {
    document.body.classList.toggle("modal-open", isPledgeOpen || isResetConfirmOpen || isRewireModalOpen);
    return () => document.body.classList.remove("modal-open");
  }, [isPledgeOpen, isResetConfirmOpen, isRewireModalOpen]);

  useEffect(() => {
    loadAnalytics().then(setAnalytics).catch(() => setLastAction("analytics unavailable"));
    loadJournalEntries().then(setJournalEntries).catch(() => setLastAction("journal unavailable"));
    loadReasons().then(setReasons).catch(() => setLastAction("reasons unavailable"));
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page]);

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  async function refreshAnalytics() {
    const data = await loadAnalytics();
    setAnalytics(withClientLoadedAt(data));
    return data;
  }

  async function handleAction(action) {
    if (action === "pledge") {
      setIsPledgeOpen(true);
      return;
    }
    if (action === "pledge confirm") {
      setIsPledgeOpen(false);
      launchConfettiBurst();
      showToast("Pledge complete");
      return;
    }
    if (action === "brain rewiring") {
      navigate("analytics");
      return;
    }
    if (action === "reset") {
      setIsResetConfirmOpen(false);
      setResetReview(createResetReview());
      setPage("reset");
      return;
    }
    if (action === "reset close") {
      setIsResetConfirmOpen(false);
      setPage("home");
      return;
    }
    if (action === "reset continue") {
      setIsResetConfirmOpen(true);
      return;
    }
    if (action === "reset cancel confirm") {
      setIsResetConfirmOpen(false);
      return;
    }
    if (action === "reset confirm") {
      setIsResetConfirmOpen(false);
      setPage("reset-triggers");
      return;
    }
    if (action === "reset review skip" || action === "reset review continue") {
      const review = action === "reset review skip" ? createResetReview() : resetReview;
      try {
        const data = await recordRelapse(review);
        setAnalytics(withClientLoadedAt(data));
        setClockNow(Date.now());
        setIsResetConfirmOpen(false);
        setPage("reset-final");
        showToast("Reset recorded");
      } catch (error) {
        showToast(error.message || "Reset failed");
      }
      return;
    }
    if (action.startsWith("reset review ")) {
      const [groupKey, ...optionParts] = action.slice("reset review ".length).split(" ");
      const option = optionParts.join(" ");
      setResetReview((current) => toggleResetReviewOption(current, groupKey, option));
      return;
    }
    if (action.startsWith("reset action ")) {
      const act = action.slice("reset action ".length);
      setSelectedResetAction(act);
      setPage("reset-commit");
      return;
    }
    if (action === "reset action continue") {
      setPage("reset-commit");
      return;
    }
    if (action === "reset commit continue") {
      setPage("reset-final");
      return;
    }
    if (action === "reset final continue") {
      setPage("home");
      showToast("Back on track");
      return;
    }
    if (action === "rewire modal close") {
      setIsRewireModalOpen(false);
      return;
    }
    if (action === "rewire modal learn") {
      setIsRewireModalOpen(false);
      return;
    }
    if (action === "urge") {
      setPage("urge");
      setUrgeFlow(createUrgeFlow());
      return;
    }
    if (action === "urge close") {
      setPage("home");
      setUrgeFlow(null);
      return;
    }
    if (action === "urge back") {
      setUrgeFlow((current) => stepUrgeFlow(current, "back"));
      return;
    }
    if (action === "urge continue") {
      setUrgeFlow((current) => stepUrgeFlow(current, "continue"));
      return;
    }
    if (action === "urge guided") {
      setUrgeFlow((current) => stepUrgeFlow(current, "guided"));
      return;
    }
    if (action.startsWith("urge intensity ")) {
      setUrgeFlow((current) => stepUrgeFlow(current, action.slice("urge ".length)));
      return;
    }
    if (action.startsWith("urge context ")) {
      setUrgeFlow((current) => stepUrgeFlow(current, action.slice("urge ".length)));
      return;
    }
    if (action.startsWith("urge alone ")) {
      setUrgeFlow((current) => stepUrgeFlow(current, action.slice("urge ".length)));
      return;
    }
    if (action.startsWith("urge response ")) {
      setUrgeFlow((current) => stepUrgeFlow(current, action.slice("urge ".length)));
      return;
    }
    if (action === "urge done") {
      try {
        const data = await recordUrgeLog(urgeFlow);
        setAnalytics(data.analytics || analytics);
        setUrgeFlow((current) => current ? { ...current, step: "logged", savedAt: new Date().toISOString() } : current);
        showToast("Urge logged");
      } catch {
        showToast("Could not save urge");
      }
      return;
    }
    if (action === "melius") {
      setPage("melius");
      return;
    }
    if (action === "streak") {
      setPage("streak-calendar");
      refreshAnalytics().catch(() => showToast("Calendar unavailable"));
      return;
    }
    if (action === "new entry") {
      setPage("journal-entry");
      return;
    }
    if (action === "reasons") {
      setPage("reasons");
      return;
    }
    if (action === "blocker") {
      setPage("blocker");
      setBlockerSubview("");
      loadBlockerState().then(setBlockerState).catch(() => showToast("Blocker unavailable"));
      return;
    }
    if (action === "blocker back") {
      setBlockerSubview("");
      setPage("home");
      return;
    }
    if (action === "blocker tier1") {
      setBlockerSubview("tier1");
      return;
    }
    if (action === "blocker tier2") {
      setBlockerSubview("tier2");
      return;
    }
    if (action === "blocker tier3") {
      setBlockerSubview("tier3");
      return;
    }
    if (action === "blocker subview back") {
      setBlockerSubview("");
      return;
    }
    if (action === "blocker desktop") {
      window.open("https://chromewebstore.google.com", "_blank");
      return;
    }
    if (action === "community") {
      setPage("community");
      loadCommunityPosts(communityFilter).then(setCommunityPosts).catch(() => showToast("Community unavailable"));
      return;
    }
    if (action === "community filter new") {
      setCommunityFilter("new");
      loadCommunityPosts("new").then(setCommunityPosts).catch(() => showToast("Filter failed"));
      return;
    }
    if (action === "community filter top") {
      setCommunityFilter("top");
      loadCommunityPosts("top").then(setCommunityPosts).catch(() => showToast("Filter failed"));
      return;
    }
    if (action === "community new post") {
      setPage("create-post");
      return;
    }
    if (action === "community back") {
      setPage("home");
      return;
    }
    if (action === "community post back") {
      setPage("community");
      setCommunityPostDetail(null);
      loadCommunityPosts(communityFilter).then(setCommunityPosts).catch(() => {});
      return;
    }
    if (action === "create post back") {
      setPage("community");
      loadCommunityPosts(communityFilter).then(setCommunityPosts).catch(() => {});
      return;
    }
    if (action.startsWith("community open ")) {
      const postId = action.slice("community open ".length);
      setCommunityPostDetail(null);
      setPage("post-detail");
      loadCommunityPost(postId).then((data) => { if (data.post) setCommunityPostDetail(data.post); }).catch(() => showToast("Post unavailable"));
      return;
    }
    if (action === "course" || action === "lessons") {
      setPage("course");
      return;
    }
    if (action === "course back") {
      setPage("library");
      return;
    }
    if (action.startsWith("course chapter ")) {
      const idx = parseInt(action.slice("course chapter ".length), 10);
      if (!isNaN(idx)) setActiveChapterIdx(idx);
      return;
    }
    if (action.startsWith("course lesson ")) {
      const lessonId = action.slice("course lesson ".length);
      for (const chapter of courseData.chapters) {
        const lesson = chapter.lessons.find((l) => l.id === lessonId);
        if (lesson) {
          setActiveLesson(lesson);
          setPage("lesson-detail");
          return;
        }
      }
      return;
    }
    if (action === "lesson back") {
      setPage("course");
      return;
    }
    if (action.endsWith(" soundscape")) {
      const title = action.replace(/ soundscape$/, "");
      const item = soundscapes.find((s) => s.title === title);
      if (item) {
        setActiveSoundscape(item);
        setPage("soundscape-player");
      }
      return;
    }
    showToast(`${titleCase(action)} action ready`);
  }

  async function saveJournalEntry(entry) {
    try {
      const data = await createJournalEntry(entry);
      setJournalEntries(data.entries || []);
      setPage("home");
      showToast("Entry saved");
    } catch {
      showToast("Entry save failed");
      throw new Error("Entry save failed");
    }
  }

  async function saveReasons(nextReasons) {
    try {
      const data = await updateReasons(nextReasons);
      setReasons(data.reasons || []);
      showToast("Reasons saved");
    } catch {
      showToast("Reasons save failed");
    }
  }

  function showToast(message) {
    setLastAction(message);
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => setLastAction(""), 1500);
  }

  function navigate(nextPage) {
    setPage(nextPage);
    if (nextPage === "analytics") {
      refreshAnalytics().catch(() => showToast("Analytics unavailable"));
    }
    if (nextPage === "community") {
      loadCommunityPosts(communityFilter).then(setCommunityPosts).catch(() => showToast("Community unavailable"));
    }
  }

  const hidesBottomNav = ["streak-calendar", "urge", "reset", "reset-triggers", "reset-action", "reset-commit", "reset-final", "journal-entry", "reasons", "blocker", "post-detail", "create-post", "soundscape-player", "lesson-detail"].includes(page);

  return h(
    "main",
    { className: page === "home" ? "app-shell" : "app-shell page-shell" },
    page === "home" ? h(HomePage, { onAction: handleAction, journalEntries, analytics, clockNow }) : null,
    page === "analytics" ? h(AnalyticsPage, { analytics, activeTab, onTab: setActiveTab, onAction: handleAction }) : null,
    page === "streak-calendar" ? h(StreakCalendarPage, { analytics, clockNow, onBack: () => setPage("home") }) : null,
    page === "library" ? h(LibraryPage, { onAction: handleAction }) : null,
    page === "profile" ? h(ProfilePage, { onAction: handleAction }) : null,
    page === "melius" ? h(MeliusChatPage, { onBack: () => setPage("analytics") }) : null,
    page === "urge" ? h(UrgeFlowPage, { flow: urgeFlow, onAction: handleAction }) : null,
    page === "reset" ? h(ResetRecoveryPage, { onAction: handleAction }) : null,
    page === "reset-triggers" ? h(ResetTriggersPage, { review: resetReview, onAction: handleAction }) : null,
    page === "reset-action" ? h(ResetActionPage, { selected: selectedResetAction, onAction: handleAction }) : null,
    page === "reset-commit" ? h(ResetCommitPage, { onAction: handleAction }) : null,
    page === "reset-final" ? h(ResetFinalPage, { onAction: handleAction }) : null,
    page === "journal-entry" ? h(NewEntryPage, { onBack: () => setPage("home"), onSave: saveJournalEntry }) : null,
    page === "reasons" ? h(ReasonsPage, { reasons, onBack: () => setPage("home"), onSave: saveReasons }) : null,
    page === "blocker" ? h(ContentBlockerPage, { blockerState, setBlockerState, subview: blockerSubview, onAction: handleAction, showToast }) : null,
    page === "community" ? h(CommunityPage, { posts: communityPosts, filter: communityFilter, onAction: handleAction }) : null,
    page === "post-detail" ? h(PostDetailPage, { post: communityPostDetail, onAction: handleAction, showToast, setPost: setCommunityPostDetail }) : null,
    page === "create-post" ? h(CreatePostPage, { onAction: handleAction, showToast }) : null,
    page === "soundscape-player" ? h(SoundscapePlayerPage, { soundscape: activeSoundscape, onBack: () => setPage("library") }) : null,
    page === "course" ? h(CourseOverviewPage, { activeChapterIdx, setActiveChapterIdx, onAction: handleAction }) : null,
    page === "lesson-detail" ? h(LessonDetailPage, { lesson: activeLesson, onAction: handleAction }) : null,
    hidesBottomNav ? null : h(BottomNav, { page, onNavigate: navigate }),
    isPledgeOpen ? h(PledgeModal, { onClose: () => setIsPledgeOpen(false), onAction: handleAction }) : null,
    isResetConfirmOpen ? h(ResetConfirmDialog, { onAction: handleAction }) : null,
    isRewireModalOpen ? h(RewireModal, { onAction: handleAction }) : null,
    lastAction ? h("div", { className: "toast", role: "status" }, lastAction) : null
  );
}

function HomePage({ onAction, journalEntries, analytics, clockNow }) {
  const homeStats = createHomeStats(analytics, clockNow);
  const currentMilestoneDay = getCurrentMilestoneDay(analytics);
  const milestoneItems = createDayMilestones(currentMilestoneDay);
  const milestonesRef = useRef(null);

  useEffect(() => {
    const container = milestonesRef.current;
    const current = container ? container.querySelector(".milestone.is-current") : null;
    if (!container || !current) return;

    const left = current.offsetLeft - container.clientWidth * 0.38;
    container.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [currentMilestoneDay]);

  return h(
    React.Fragment,
    null,
    h("section", { ref: milestonesRef, className: "milestones", "aria-label": "90 day milestones" }, milestoneItems.map((item) => h(Milestone, { key: item.day, item, onAction }))),
    h("section", { className: "stats-grid", "aria-label": "Recovery stats" }, homeStats.map((item) => h(StatCard, { key: item.label, item, onAction }))),
    h("section", { className: "quick-grid", "aria-label": "Quick actions" }, quickActions.map((item) => h(QuickAction, { key: item.action, item, onAction }))),
    h(ProgressPill, { onAction }),
    h("section", { className: "card-stack", "aria-label": "Support tools" }, cards.map((card) => h(FeatureCard, { key: card.action, card, onAction, journalEntries }))),
    h(QuoteBlock),
    h("button", { className: "panic-button", type: "button", onClick: () => onAction("panic") }, h(Icon, { name: "warning" }), h("span", null, "Panic Button"))
  );
}

function UrgeFlowPage({ flow, onAction }) {
  if (!flow) return null;

  return h(
    "section",
    { className: "urge-flow" },
    h("header", { className: "urge-topbar" },
      h("button", { className: "icon-button", type: "button", onClick: () => onAction("urge close"), "aria-label": "Close urge flow" }, h(Icon, { name: "close" })),
      h("strong", null, "Urge Tracker"),
      h("span", { className: "urge-topbar-spacer" })
    ),
    h("div", { className: "urge-progress" }, h("span", { style: { width: `${flow.progress}%` } })),
    flow.step === "intensity" ? h(UrgeIntensityStep, { flow, onAction }) : null,
    flow.step === "context" ? h(UrgeContextStep, { flow, onAction }) : null,
    flow.step === "ground" ? h(UrgeGroundStep, { flow, onAction }) : null,
    flow.step === "response" ? h(UrgeResponseStep, { flow, onAction }) : null,
    flow.step === "guided" ? h(UrgeGuidedStep, { flow, onAction }) : null,
    flow.step === "logged" ? h(UrgeLoggedStep, { flow, onAction }) : null
  );
}

function UrgeIntensityStep({ flow, onAction }) {
  return h(
    React.Fragment,
    null,
    h("section", { className: "urge-stage" },
      h("h1", null, "How intense is your urge?"),
      h("div", { className: "urge-orb" },
        h("strong", null, flow.intensityLabel),
        h("small", null, `${flow.intensityValue}%`)
      ),
      h("div", { className: "urge-pills" }, flow.intensityOptions.map((item) =>
        h("button", { key: item.label, type: "button", className: flow.intensityLabel === item.label ? "urge-pill is-active" : "urge-pill", onClick: () => onAction(`urge intensity ${item.label}`) }, item.label)
      )),
      h("div", { className: "urge-slider-block" },
        h("input", {
          className: "urge-slider",
          type: "range",
          min: 10,
          max: 100,
          step: 1,
          value: flow.intensityValue,
          onChange: (event) => onAction(`urge intensity value ${event.target.value}`)
        }),
        h("div", { className: "urge-scale" }, h("span", null, "10%"), h("span", null, "100%"))
      ),
      h("button", { className: "urge-primary", type: "button", onClick: () => onAction("urge continue") }, "Continue", h(Icon, { name: "chevron" }))
    )
  );
}

function UrgeContextStep({ flow, onAction }) {
  return h(
    "section",
    { className: "urge-stage" },
    h("h1", null, "Where are you?"),
    h("p", { className: "urge-subtitle" }, "Helps identify patterns"),
    h("div", { className: "urge-chip-grid" }, flow.contextOptions.map((item) =>
      h("button", { key: item, type: "button", className: flow.context === item ? "urge-chip is-active" : "urge-chip", onClick: () => onAction(`urge context ${item}`) }, item)
    )),
    h("div", { className: "urge-question" },
      h("strong", null, "Are you alone?"),
      h("div", { className: "urge-toggle-row" },
        h("button", { type: "button", className: flow.alone === true ? "urge-toggle is-active" : "urge-toggle", onClick: () => onAction("urge alone yes") }, "Yes"),
        h("button", { type: "button", className: flow.alone === false ? "urge-toggle is-active" : "urge-toggle", onClick: () => onAction("urge alone no") }, "No")
      )
    ),
    h("button", { className: "urge-primary", type: "button", disabled: !flow.context || flow.alone === null, onClick: () => onAction("urge continue") }, "Continue", h(Icon, { name: "chevron" })),
    h("button", { className: "urge-text-button", type: "button", onClick: () => onAction("urge continue") }, "Skip this step")
  );
}

function UrgeGroundStep({ onAction }) {
  return h(
    "section",
    { className: "urge-stage urge-centered" },
    h("h1", null, "Ground Yourself"),
    h("p", { className: "urge-subtitle" }, "Slow breathing calms your nervous system"),
    h("button", { className: "urge-primary", type: "button", onClick: () => onAction("urge continue") }, "Begin", h(Icon, { name: "chevron" })),
    h("button", { className: "urge-text-button", type: "button", onClick: () => onAction("urge continue") }, "Skip this step")
  );
}

function UrgeResponseStep({ flow, onAction }) {
  return h(
    "section",
    { className: "urge-stage" },
    h("h1", null, "How will you respond?"),
    h("p", { className: "urge-subtitle" }, "Choose your action"),
    h("div", { className: "urge-response-list" }, flow.responseOptions.map((item) =>
      h("button", { key: item.title, type: "button", className: flow.response === item.title ? "urge-response is-active" : "urge-response", onClick: () => onAction(`urge response ${item.title}`) },
        h("span", { className: "urge-response-icon" }, h(Icon, { name: item.icon })),
        h("span", { className: "urge-response-copy" }, h("strong", null, item.title), h("small", null, item.subtitle)),
        flow.response === item.title ? h("span", { className: "urge-check" }, "✓") : null
      )
    )),
    h("button", { className: "urge-primary", type: "button", disabled: !flow.response, onClick: () => onAction(flow.guidedActions.includes(flow.response) ? "urge guided" : "urge done") }, "Continue", h(Icon, { name: "chevron" }))
  );
}

function UrgeGuidedStep({ flow, onAction }) {
  return h(
    "section",
    { className: "urge-stage urge-centered" },
    h("h1", null, flow.response),
    h("p", { className: "urge-subtitle" }, "Follow this short guided reset, then log the urge."),
    h("button", { className: "urge-primary", type: "button", onClick: () => onAction("urge done") }, "Done", h(Icon, { name: "chevron" }))
  );
}

function UrgeLoggedStep({ flow, onAction }) {
  return h(
    "section",
    { className: "urge-stage urge-centered" },
    h("div", { className: "urge-logged-mark" }, h(Icon, { name: "check-circle" })),
    h("h1", null, "Urge Logged"),
    h("p", { className: "urge-subtitle" }, "You stayed in control."),
    h("div", { className: "urge-summary" },
      h("div", null, h("span", null, "Intensity"), h("strong", null, flow.intensityLabel)),
      h("div", null, h("span", null, "Response"), h("strong", null, flow.response || "Not set")),
      h("div", null, h("span", null, "Trigger"), h("strong", null, flow.context || "Unknown"))
    ),
    h("button", { className: "urge-primary", type: "button", onClick: () => onAction("urge close") }, "Done")
  );
}

function ResetRecoveryPage({ onAction }) {
  return h(
    "section",
    { className: "reset-recovery-page" },
    h("button", { className: "reset-close", type: "button", onClick: () => onAction("reset close"), "aria-label": "Close reset page" }, h(Icon, { name: "close" })),
    h("header", { className: "reset-recovery-header" }, h("strong", null, "Let's keep going")),
    h("section", { className: "reset-recovery-content" },
      h("div", { className: "reset-illustration", "aria-hidden": "true" },
        h("span", { className: "reset-planet blue" }),
        h("span", { className: "reset-planet gold" }),
        h("span", { className: "reset-orbit" }),
        h("span", { className: "reset-glow" }),
        h("span", { className: "reset-person" },
          h("i", { className: "head" }),
          h("i", { className: "hair" }),
          h("i", { className: "beard" }),
          h("i", { className: "body" }),
          h("i", { className: "arm left" }),
          h("i", { className: "arm right" }),
          h("i", { className: "hand left" }),
          h("i", { className: "hand right" }),
          h("i", { className: "leg left" }),
          h("i", { className: "leg right" }),
          h("i", { className: "shoe left" }),
          h("i", { className: "shoe right" })
        ),
        h("span", { className: "reset-shadow" })
      ),
      h("div", { className: "reset-recovery-copy" },
        h("h1", null, "You didn't lose your progress"),
        h("p", null, "Slip-ups happen and can make you feel bad, but it's crucial not to be too hard on yourself. You're getting closer to freedom.")
      ),
      h("button", { className: "reset-support-card", type: "button", onClick: () => onAction("therapy") },
        h("span", { className: "reset-support-icon" }, h(Icon, { name: "hand" })),
        h("span", { className: "reset-support-copy" }, h("strong", null, "Need Extra Support?"), h("small", null, "Speak to a Therapist via BetterHelp")),
        h("span", { className: "reset-support-next" }, h(Icon, { name: "chevron" }))
      ),
      h("blockquote", { className: "reset-quote" },
        h("span", { className: "quote-open" }, "\""),
        h("p", null, "Your strength is proven in your ability to overcome addiction."),
        h("span", { className: "quote-close" }, "\"")
      )
    ),
    h("button", { className: "reset-continue", type: "button", onClick: () => onAction("reset continue") }, h(Icon, { name: "chevron" }), h("span", null, "Continue from today"))
  );
}

function ResetConfirmDialog({ onAction }) {
  return h(
    "section",
    { className: "reset-confirm-backdrop", role: "dialog", "aria-modal": "true", "aria-label": "Confirm reset" },
    h("div", { className: "reset-confirm-dialog" },
      h("div", { className: "reset-app-icon", "aria-hidden": "true" }, h("span", null, "QUITTR")),
      h("h2", null, "Are you sure?"),
      h("p", null, "Tapping this restarts your streak."),
      h("div", { className: "reset-confirm-actions" },
        h("button", { className: "reset-confirm-cancel", type: "button", onClick: () => onAction("reset cancel confirm") }, "Cancel"),
        h("button", { className: "reset-confirm-continue", type: "button", onClick: () => onAction("reset confirm") }, "Continue")
      )
    )
  );
}

function ResetTriggersPage({ review, onAction }) {
  const selectedCount = getResetSelectionCount(review);

  return h(
    "section",
    { className: "reset-triggers-page" },
    h("div", { className: "reset-trigger-progress", "aria-hidden": "true" }, h("span", null)),
    h("header", { className: "reset-trigger-header" },
      h("div", { className: "reset-trigger-logo", "aria-hidden": "true" }, "QUITTR"),
      h("h1", null, "Quick reset check-in"),
      h("p", null, "No writing needed. Tap what fits, or skip and move on.")
    ),
    h("section", { className: "reset-review-list", "aria-label": "Reset reflection" },
      resetReflectionGroups.map((group) =>
        h("article", { className: "reset-review-group", key: group.key },
          h("div", { className: "reset-review-heading" },
            h("strong", null, group.title),
            h("small", null, group.subtitle)
          ),
          h("div", { className: "reset-review-chips" },
            group.options.map((option) => {
              const isSelected = (review[group.key] || []).includes(option);
              return h(
                "button",
                {
                  key: option,
                  className: isSelected ? "reset-review-chip is-selected" : "reset-review-chip",
                  type: "button",
                  onClick: () => onAction(`reset review ${group.key} ${option}`)
                },
                h("span", null, option),
                isSelected ? h(Icon, { name: "check" }) : null
              );
            })
          )
        )
      )
    ),
    h("footer", { className: "reset-review-footer" },
      h("button", { className: "reset-review-skip", type: "button", onClick: () => onAction("reset review skip") }, "Skip"),
      h("button", { className: "reset-trigger-continue", type: "button", onClick: () => onAction("reset review continue") },
        h("span", null, selectedCount ? `Save ${selectedCount}` : "Save blank"),
        h(Icon, { name: "chevron" })
      )
    )
  );
}

function NewEntryPage({ onBack, onSave }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const canSave = title.trim() || body.trim();

  async function handleSave() {
    if (!canSave || isSaving) return;
    setIsSaving(true);
    try {
      await onSave({ title, body });
    } finally {
      setIsSaving(false);
    }
  }

  return h(
    "section",
    { className: "journal-entry-page" },
    h("header", { className: "journal-entry-topbar" },
      h("button", { type: "button", className: "journal-nav-button", onClick: onBack, "aria-label": "Back" }, h(Icon, { name: "chevron-left" })),
      h("strong", null, "New Entry"),
      h("button", { type: "button", className: "journal-save-button", disabled: !canSave || isSaving, onClick: handleSave, "aria-label": "Save entry" }, h(Icon, { name: "check" }))
    ),
    h("input", {
      className: "journal-title-input",
      value: title,
      onChange: (event) => setTitle(event.target.value),
      placeholder: "Title",
      autoFocus: true
    }),
    h("textarea", {
      className: "journal-body-input",
      value: body,
      onChange: (event) => setBody(event.target.value),
      placeholder: "Start writing here..."
    })
  );
}

function ReasonsPage({ reasons, onBack, onSave }) {
  const [draftReasons, setDraftReasons] = useState(() => reasons.length ? reasons : [""]);

  useEffect(() => {
    setDraftReasons(reasons.length ? reasons : [""]);
  }, [reasons]);

  function updateReason(index, value) {
    const next = draftReasons.map((reason, reasonIndex) => reasonIndex === index ? value : reason);
    setDraftReasons(next);
    onSave(next);
  }

  function addReason() {
    setDraftReasons([...draftReasons, ""]);
  }

  return h(
    "section",
    { className: "reasons-page" },
    h("header", { className: "reasons-topbar" },
      h("button", { type: "button", className: "reasons-back-button", onClick: onBack, "aria-label": "Back" }, h(Icon, { name: "chevron-left" })),
      h("strong", null, "Quitting Reasons"),
      h("span", null)
    ),
    h("p", { className: "reasons-intro" }, "Remind yourself why you started. Listing specific reasons helps anchor you when things get tough."),
    h("section", { className: "reasons-list", "aria-label": "Reasons for quitting" }, draftReasons.map((reason, index) =>
      h("label", { key: index, className: "reason-row" },
        h("span", { "aria-hidden": "true" }),
        h("input", {
          value: reason,
          onChange: (event) => updateReason(index, event.target.value),
          placeholder: "Enter reason..."
        })
      )
    )),
    h("button", { type: "button", className: "add-reason-button", onClick: addReason }, h(Icon, { name: "plus-circle" }), h("span", null, "Add Another Reason"))
  );
}

function StreakCalendarPage({ analytics, clockNow, onBack }) {
  const data = analytics || createFallbackAnalytics();
  const today = startOfCalendarDay(new Date(clockNow || Date.now()));
  const [visibleMonth, setVisibleMonth] = useState(() => startOfCalendarMonth(today));
  const days = createCalendarMonthCells(visibleMonth);
  const streakDayCount = getCalendarStreakDayCount(data, today, clockNow);

  return h(
    "section",
    { className: "streak-calendar-page" },
    h("header", { className: "streak-calendar-topbar" },
      h("button", { className: "streak-calendar-back", type: "button", onClick: onBack, "aria-label": "Back" }, h(Icon, { name: "chevron-left" })),
      h("strong", null, "Streak Calendar"),
      h("span", { className: "streak-calendar-topbar-spacer" })
    ),
    h("section", { className: "streak-calendar-summary", "aria-label": "Current streak" },
      h("span", null, "Current Streak"),
      h("strong", null, streakDayCount),
      h("small", null, "Days")
    ),
    h("section", { className: "streak-calendar-month" },
      h("button", { type: "button", onClick: () => setVisibleMonth((month) => addCalendarMonths(month, -1)), "aria-label": "Previous month" }, h(Icon, { name: "chevron-left" })),
      h("h1", null, formatCalendarMonth(visibleMonth)),
      h("button", { type: "button", onClick: () => setVisibleMonth((month) => addCalendarMonths(month, 1)), "aria-label": "Next month" }, h(Icon, { name: "chevron" }))
    ),
    h("section", { className: "streak-calendar-card", role: "grid", "aria-label": `${formatCalendarMonth(visibleMonth)} streak calendar` },
      calendarWeekdays.map((day) => h("span", { key: day, className: "streak-calendar-weekday", role: "columnheader" }, day)),
      days.map((cell) => h(StreakCalendarDay, { key: cell.key, cell, data, today }))
    ),
    h("footer", { className: "streak-calendar-legend" },
      h("span", { className: "legend-clean" }, "Clean"),
      h("span", { className: "legend-relapse" }, "Relapse"),
      h("span", { className: "legend-no-data" }, "No Data")
    )
  );
}

function StreakCalendarDay({ cell, data, today }) {
  if (!cell.date) {
    return h("span", { className: "streak-calendar-day is-empty", role: "gridcell" });
  }

  const status = getCalendarDayStatus(cell.date, data, today);
  const isToday = isSameCalendarDay(cell.date, today);
  const className = ["streak-calendar-day", `is-${status}`, isToday ? "is-today" : ""].filter(Boolean).join(" ");
  const label = `${formatCalendarDate(cell.date)}, ${getCalendarStatusLabel(status)}`;

  return h(
    "span",
    { className, role: "gridcell", "aria-label": label },
    h("span", { className: "streak-calendar-day-marker" },
      status === "clean" ? h(Icon, { name: "check" }) : null,
      status === "relapse" ? h(Icon, { name: "close" }) : null,
      status === "no-data" ? cell.date.getDate() : null
    )
  );
}

function AnalyticsPage({ analytics, activeTab, onTab, onAction }) {
  const data = analytics || createFallbackAnalytics();

  return h(
    "section",
    { className: "analytics-page" },
    h("h1", null, "Analytics"),
    h("div", { className: "analytics-tabs", role: "tablist" }, ["overview", "stats", "urges"].map((tab) =>
      h("button", { key: tab, className: activeTab === tab ? "analytics-tab is-active" : "analytics-tab", type: "button", onClick: () => onTab(tab) }, titleCase(tab))
    )),
    activeTab === "overview"
      ? h(OverviewPanel, { data, onAction })
      : h("section", { className: "coming-soon" }, h("h2", null, titleCase(activeTab)), h("p", null, "This section is ready for the next feature pass."))
  );
}

function OverviewPanel({ data, onAction }) {
  return h(
    React.Fragment,
    null,
    h(DaysCleanRing, { data }),
    h("button", { className: "melius-card", type: "button", onClick: () => onAction("melius") },
      h("span", { className: "melius-icon" }, h(Icon, { name: "melius" })),
      h("span", { className: "melius-copy" }, h("strong", null, "Talk to Melius"), h("small", null, "Your AI therapist")),
      h("span", { className: "chevron" }, h(Icon, { name: "chevron" }))
    ),
    h(ProgressChart, { points: data.progressPoints }),
    h(StreakJourney, { streaks: data.streaks }),
    h(AnalyticsStats, { stats: data.stats }),
    h("section", { className: "encouragement" }, h("h2", null, data.encouragement.title), h("p", null, data.encouragement.body))
  );
}

function DaysCleanRing({ data }) {
  const days = Number(data.currentStreakDays) || 0;
  const progress = Math.min(0.82, Math.max(0.08, days / 30));
  const circumference = 2 * Math.PI * 84;

  return h(
    "section",
    { className: "days-ring" },
    h("svg", { viewBox: "0 0 220 220", "aria-hidden": "true" },
      h("circle", { className: "ring-track", cx: "110", cy: "110", r: "84" }),
      h("circle", { className: "ring-progress", cx: "110", cy: "110", r: "84", strokeDasharray: `${circumference}`, strokeDashoffset: `${circumference * (1 - progress)}` }),
      h("circle", { className: "ring-dot", cx: "126", cy: "188", r: "11" }),
      h("path", { className: "ring-check", d: "m120 187 5 5 10-12" })
    ),
    h("div", { className: "days-ring-copy" }, h("span", null, "Days Clean"), h("strong", null, data.currentStreakLabel), h("small", null, "Apprentice")),
    h("span", { className: "breakthrough" }, "Breakthrough")
  );
}

function ProgressChart({ points }) {
  const normalized = normalizeChartPoints(points, 360, 170);
  const progressPath = normalized.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

  return h(
    "section",
    { className: "chart-section" },
    h("h2", null, "Progress"),
    h("div", { className: "legend" }, h("span", { className: "relapse-key" }, "Relapse"), h("span", { className: "progress-key" }, "Progress")),
    h("svg", { className: "progress-chart", viewBox: "0 0 380 190", role: "img", "aria-label": "Progress chart" },
      [70, 130, 190, 250, 310].map((x) => h("line", { key: x, className: "chart-grid", x1: x, x2: x, y1: "15", y2: "172" })),
      h("path", { className: "chart-fill", d: `${progressPath} L 360 175 L 20 175 Z` }),
      h("path", { className: "progress-line", d: progressPath }),
      normalized.filter((point) => point.type === "relapse").map((point) => h("circle", { key: point.id, className: "relapse-point", cx: point.x, cy: point.y, r: "7" })),
      h("path", { className: "chart-arrow", d: "M 344 86 L 360 80 L 356 96" })
    )
  );
}

function StreakJourney({ streaks }) {
  const visible = streaks.slice(-7);
  const max = Math.max(1, ...visible.map((item) => item.days));

  return h(
    "section",
    { className: "journey-section" },
    h("div", { className: "journey-heading" }, h("span", null, h("h2", null, "Streak Journey"), h("small", null, `${streaks.length} streaks tracked`)), h(Icon, { name: "chevron" })),
    h("div", { className: "legend" }, h("span", { className: "streak-key" }, "Streak"), h("span", { className: "relapse-key" }, "Reset")),
    h("div", { className: "journey-chart" }, visible.map((item) =>
      h("span", { key: item.id, className: "journey-bar-wrap" },
        h("i", { className: item.relapseAt ? "reset-dot" : "reset-dot is-current" }),
        h("b", { style: { height: `${Math.max(8, (item.days / max) * 42)}px` } }),
        h("small", null, Math.round(item.days))
      )
    ))
  );
}

function AnalyticsStats({ stats }) {
  return h(
    "section",
    { className: "analytics-stats" },
    h("div", { className: "metric-circle gold" }, h("span", null, h(Icon, { name: "crown" })), h("strong", null, stats.bestStreakLabel), h("small", null, "Best Streak")),
    h("div", { className: "metric-circle green" }, h("span", null, h(Icon, { name: "stats" })), h("strong", null, stats.avgStreakLabel), h("small", null, "Avg Streak")),
    h("div", { className: "metric-circle red" }, h("span", null, h(Icon, { name: "undo" })), h("strong", null, stats.relapseCount), h("small", null, "Relapses")),
    h("div", { className: "metric-card karma" }, h("strong", null, h(Icon, { name: "heart" }), " ", stats.karma), h("small", null, "Karma")),
    h("div", { className: "metric-card rank" }, h("strong", null, h(Icon, { name: "bars" }), " Top ", stats.rankPercent, "%"), h("small", null, "In QUITTR"))
  );
}

function LibraryPage({ onAction }) {
  return h(
    "section",
    { className: "library-page" },
    h("h1", null, "Library"),
    h("section", { className: "library-shortcuts", "aria-label": "Library shortcuts" }, libraryShortcuts.map((item) => h(LibraryShortcut, { key: item.label, item, onAction }))),
    h(LibraryHeader, { title: "Soundscapes", subtitle: "Relax & drift into a different world to help mitigate urges", action: "soundscapes", onAction }),
    h("section", { className: "soundscape-list", "aria-label": "Soundscapes" }, soundscapes.map((item) => h(SoundscapeButton, { key: item.title, item, onAction }))),
    h("button", { className: "mountain-card", type: "button", onClick: () => onAction("progress mountain") },
      h("span", { className: "mountain-copy" }, h("strong", null, "Progress Mountain"), h("small", null, "Climb the mountain with every day of progress")),
      h("span", { className: "mountain-shape", "aria-hidden": "true" })
    ),
    h(LibraryHeader, { title: "Continue Lesson", subtitle: "Pick up exactly where you left off", action: "lessons", onAction }),
    h("section", { className: "lesson-timeline", "aria-label": "Continue Lesson" }, lessons.map((item) => h(LessonItem, { key: item.title, item, onAction }))),
    h(LibraryHeader, { title: "Games", subtitle: "Defeat urges with cognitive exercises", action: "games", onAction }),
    h("section", { className: "games-row", "aria-label": "Games" }, games.map((item) => h(GameCard, { key: item.title, item, onAction }))),
    h(LibraryHeader, { title: "Leaderboard", action: "leaderboard", onAction }),
    h("button", { className: "leaderboard-card", type: "button", onClick: () => onAction("leaderboard") },
      leaderboardRows.map((row) => h("span", { key: row.rank, className: "leaderboard-row" },
        h("i", { className: row.tone }, row.rank),
        h("b", { style: { width: row.width } }),
        h("em")
      ))
    ),
    h("button", { className: "share-card", type: "button", onClick: () => onAction("share quittr") }, h("strong", null, "Share QUITTR"), h("span", null, "and get rewards"), h("i", null, h(Icon, { name: "gift" })))
  );
}

function LibraryHeader({ title, subtitle, action, onAction }) {
  return h(
    "header",
    { className: "library-section-header" },
    h("span", null, h("h2", null, title), subtitle ? h("p", null, subtitle) : null),
    h("button", { type: "button", "aria-label": `${title} details`, onClick: () => onAction(action) }, h(Icon, { name: "chevron" }))
  );
}

function LibraryShortcut({ item, onAction }) {
  return h("button", { className: "library-shortcut", type: "button", onClick: () => onAction(item.action) }, h("span", null, h(Icon, { name: item.icon })), h("strong", null, item.label));
}

function SoundscapeButton({ item, onAction }) {
  return h("button", { className: `soundscape-card ${item.tone}`, type: "button", onClick: () => onAction(`${item.title} soundscape`) }, h("strong", null, item.title), h("span", null, h(Icon, { name: "play" })));
}

function SoundscapePlayerPage({ soundscape, onBack }) {
  const [current, setCurrent] = useState(soundscape);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [elapsed, setElapsed] = useState(0);
  const engineRef = useRef(null);
  const timerRef = useRef(null);

  const startEngine = (item) => {
    if (engineRef.current) engineRef.current.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    const engine = new SoundscapeEngine(item.tone);
    engine.setVolume(volume);
    engine.start();
    engineRef.current = engine;
    setIsPlaying(true);
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((p) => p + 1), 1000);
  };

  useEffect(() => {
    if (!soundscape) return;
    startEngine(soundscape);
    return () => {
      if (engineRef.current) engineRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (engineRef.current) engineRef.current.setVolume(volume);
  }, [volume]);

  const switchTo = (item) => {
    setCurrent(item);
    startEngine(item);
  };

  const togglePlay = () => {
    if (!engineRef.current) return;
    if (isPlaying) { engineRef.current.stop(); setIsPlaying(false); }
    else { engineRef.current.start(); setIsPlaying(true); }
  };

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  if (!current) return null;

  const others = soundscapes.filter((s) => s.tone !== current.tone);

  return h("section", { className: `soundscape-player ${current.tone}` },
    h("header", { className: "soundscape-player-header" },
      h("button", { className: "icon-button", type: "button", onClick: onBack, "aria-label": "Back" }, h(Icon, { name: "chevron-left" })),
      h("strong", null, "Soundscapes"),
      h("span", { className: "soundscape-header-spacer" })
    ),
    h("div", { className: "soundscape-player-main" },
      h("div", { className: "soundscape-player-emoji" }, current.emoji),
      h("h1", { className: "soundscape-player-title" }, current.title),
      h("p", { className: "soundscape-player-desc" }, current.description),
      h("div", { className: "soundscape-player-time" }, formatTime(elapsed)),
      h("button", { className: "soundscape-play-btn", type: "button", onClick: togglePlay, "aria-label": isPlaying ? "Pause" : "Play" },
        h(Icon, { name: isPlaying ? "pause" : "play" })
      ),
      h("div", { className: "soundscape-volume" },
        h("span", { className: "soundscape-vol-icon" }, h(Icon, { name: "music" })),
        h("input", {
          type: "range", min: "0", max: "1", step: "0.01", value: volume,
          className: "soundscape-vol-slider",
          "aria-label": "Volume",
          onInput: (e) => setVolume(Number(e.target.value))
        })
      ),
      h("section", { className: "soundscape-others", "aria-label": "Other soundscapes" },
        h("p", { className: "soundscape-others-title" }, "Try another"),
        h("div", { className: "soundscape-mini-row" },
          others.map((s) =>
            h("button", { key: s.tone, className: `soundscape-mini ${s.tone}`, type: "button", onClick: () => switchTo(s) },
              h("span", null, s.emoji),
              h("strong", null, s.title)
            )
          )
        )
      )
    )
  );
}

function LessonItem({ item, onAction }) {
  return h(
    "button",
    { className: `lesson-item ${item.tone}`, type: "button", onClick: () => onAction(item.title) },
    h("span", { className: "lesson-step" }, h(Icon, { name: item.icon })),
    h("span", { className: "lesson-copy" }, h("strong", null, item.title), h("small", null, item.status)),
    item.tone === "current" ? h("span", { className: "lesson-next" }, h(Icon, { name: "chevron" })) : null
  );
}

function CourseOverviewPage({ activeChapterIdx, setActiveChapterIdx, onAction }) {
  const chapter = courseData.chapters[activeChapterIdx];
  const totalLessons = courseData.chapters.reduce((sum, ch) => sum + ch.lessons.length, 0);
  const completedLessons = courseData.chapters.reduce((sum, ch) => sum + ch.lessons.filter((l) => l.status === "completed").length, 0);
  const chapterCompleted = chapter.lessons.filter((l) => l.status === "completed").length;
  const chapterTotal = chapter.lessons.length;
  const progressPercent = chapterTotal > 0 ? (chapterCompleted / chapterTotal) * 100 : 0;

  return h(
    "section",
    { className: "course-page" },
    h("header", { className: "course-header" },
      h("button", { className: "icon-button", type: "button", onClick: () => onAction("course back"), "aria-label": "Back" }, h(Icon, { name: "chevron-left" })),
      h("div", { className: "course-header-copy" },
        h("h1", null, "Learn"),
        h("p", null, courseData.title)
      )
    ),
    h("div", { className: "course-badge" },
      h("span", { className: "course-badge-tag" }, courseData.tag),
      h("span", { className: "course-badge-progress" }, completedLessons, "/", totalLessons, " complete")
    ),
    h("nav", { className: "course-chapters", "aria-label": "Chapters" },
      courseData.chapters.map((ch, idx) =>
        h("button", {
          key: ch.id,
          className: `course-chapter-btn${idx === activeChapterIdx ? " is-active" : ""}`,
          type: "button",
          onClick: () => setActiveChapterIdx(idx)
        },
          h("span", { className: "course-chapter-icon" }, h(Icon, { name: "folder" })),
          h("span", { className: "course-chapter-label" },
            h("small", null, "Chapter ", idx + 1),
            h("strong", null, ch.title)
          )
        )
      )
    ),
    h("div", { className: "course-progress-wrap" },
      h("div", { className: "course-progress-bar" },
        h("span", { className: "course-progress-fill", style: { width: progressPercent + "%" } })
      ),
      h("div", { className: "course-progress-info" },
        h("span", null, chapterCompleted, "/", chapterTotal),
        chapterCompleted === chapterTotal ? h("span", { className: "course-progress-star" }, "\u2B50") : null
      )
    ),
    h("section", { className: "course-lessons", "aria-label": "Lessons" },
      chapter.lessons.map((lesson, idx) =>
        h(CourseLessonCard, { key: lesson.id, lesson, index: idx, onAction })
      )
    )
  );
}

function CourseLessonCard({ lesson, index, onAction }) {
  const statusClass = lesson.status === "completed" ? "completed" : lesson.status === "current" ? "current" : "locked";
  const iconName = lesson.status === "completed" ? "check-circle" : lesson.status === "current" ? "dot" : "lock";
  const isClickable = lesson.status !== "locked";
  return h(
    "button",
    {
      className: `course-lesson-card ${statusClass}`,
      type: "button",
      disabled: !isClickable,
      onClick: () => isClickable && onAction(`course lesson ${lesson.id}`)
    },
    h("span", { className: "course-lesson-step" }, h(Icon, { name: iconName })),
    h("span", { className: "course-lesson-copy" },
      h("strong", null, "Lesson ", index + 1),
      h("span", null, lesson.title),
      h("small", null, lesson.status === "completed" ? "Completed" : lesson.status === "current" ? "Continue learning" : "Locked")
    ),
    h("span", { className: "course-lesson-meta" },
      h("span", { className: "course-lesson-duration" }, h(Icon, { name: "hourglass" }), " ", lesson.duration),
      isClickable ? h("span", { className: "course-lesson-chevron" }, h(Icon, { name: "chevron" })) : null
    )
  );
}

function LessonDetailPage({ lesson, onAction }) {
  const [marked, setMarked] = useState(lesson ? lesson.status === "completed" : false);
  if (!lesson) return null;
  const handleMark = () => { setMarked(true); };

  return h(
    "section",
    { className: "lesson-page" },
    h("header", { className: "lesson-page-header" },
      h("button", { className: "icon-button", type: "button", onClick: () => onAction("lesson back"), "aria-label": "Back" }, h(Icon, { name: "chevron-left" })),
      h("div", { className: "lesson-page-badge" },
        h(Icon, { name: "folder" }),
        h("span", null, "Lesson")
      )
    ),
    h("article", { className: "lesson-page-content" },
      h("h1", { className: "lesson-page-title" }, lesson.title),
      h("div", { className: "lesson-page-duration" }, h(Icon, { name: "hourglass" }), " ", lesson.duration),
      lesson.sections.map((section, idx) =>
        h("section", { key: idx, className: "lesson-section" },
          h("h2", null, section.heading),
          h("p", null, section.body)
        )
      ),
      lesson.reflection ? h("div", { className: "lesson-reflection" },
        h("h3", null, "Reflection"),
        h("p", null, lesson.reflection)
      ) : null
    ),
    h("div", { className: "lesson-page-footer" },
      marked
        ? h("div", { className: "lesson-marked-done" }, h(Icon, { name: "check-circle" }), " Lesson Completed")
        : h("button", { className: "lesson-mark-btn", type: "button", onClick: handleMark },
            h(Icon, { name: "check" }), " Mark as Complete")
    )
  );
}

function GameCard({ item, onAction }) {
  return h("button", { className: `game-card ${item.tone}`, type: "button", onClick: () => onAction(item.title) }, h("span", null, h(Icon, { name: item.icon })), h("strong", null, item.title));
}

function ProfilePage({ onAction }) {
  return h(
    "section",
    { className: "profile-page" },
    h("section", { className: "profile-hero", "aria-label": "Profile header" },
      h("div", { className: "profile-actions" },
        h("button", { type: "button", "aria-label": "Share profile", onClick: () => onAction("share profile") }, h(Icon, { name: "share" })),
        h("button", { type: "button", "aria-label": "Profile settings", onClick: () => onAction("profile settings") }, h(Icon, { name: "gear" }))
      ),
      h("div", { className: "profile-avatar-main" }, h(Icon, { name: "profile" }))
    ),
    h("section", { className: "profile-panel" },
      h("button", { className: "edit-profile-button", type: "button", onClick: () => onAction("edit profile") }, "Edit Profile"),
      h("div", { className: "karma-line" }, h(Icon, { name: "diamond" }), h("span", null, "1 Karma")),
      h("section", { className: "badge-row", "aria-label": "Profile badges" }, profileBadges.map((badge, index) =>
        h("button", { key: `${badge.tone}-${index}`, className: `profile-badge ${badge.tone}`, type: "button", "aria-label": badge.label, onClick: () => onAction(badge.label) }, badge.tone === "locked" ? h(Icon, { name: "lock" }) : null)
      )),
      h("header", { className: "profile-section-header" },
        h("h2", null, "Achievements"),
        h("button", { type: "button", "aria-label": "Achievements details", onClick: () => onAction("achievements") }, h(Icon, { name: "chevron" }))
      ),
      h("section", { className: "achievement-row", "aria-label": "Achievements" }, achievements.map((item, index) => h(AchievementBadge, { key: `${item.tone}-${index}`, item, onAction }))),
      h("header", { className: "profile-section-header posts-header" },
        h("span", null, h("h2", null, "My Posts"), h("b", null, "1")),
        h("button", { type: "button", onClick: () => onAction("see all posts") }, "See all ", h(Icon, { name: "chevron" }))
      ),
      h("article", { className: "post-card" },
        h("span", { className: "post-avatar", "aria-hidden": "true" }),
        h("div", { className: "post-body" },
          h("header", null, h("strong", null, "Unknown User"), h("span", null, "·"), h("small", null, "2w ago"), h("button", { type: "button", "aria-label": "Post options", onClick: () => onAction("post options") }, "•••")),
          h("h3", null, "cant stop surfing internet"),
          h("p", null, "whenever i surf the Internet too long the urge come and cant resist"),
          h("footer", null,
            h("button", { type: "button", onClick: () => onAction("comments") }, h(Icon, { name: "comment" }), "0"),
            h("button", { type: "button", onClick: () => onAction("likes") }, h(Icon, { name: "heart-outline" }), "0"),
            h("button", { type: "button", onClick: () => onAction("post stats") }, h(Icon, { name: "stats" }), "1")
          )
        )
      )
    )
  );
}

function AchievementBadge({ item, onAction }) {
  return h(
    "button",
    { className: `achievement-badge ${item.tone}`, type: "button", onClick: () => onAction("achievement") },
    h("span", null, h(Icon, { name: item.icon })),
    item.count ? h("b", null, item.count) : null
  );
}

function MeliusChatPage({ onBack }) {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState([]);
  const [isSending, setIsSending] = useState(false);

  async function sendMessage(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || isSending) return;
    const nextMessages = [...messages, { role: "user", text }];
    setMessages(nextMessages);
    setDraft("");
    setIsSending(true);
    try {
      const reply = await sendMeliusMessage(nextMessages);
      setMessages([...nextMessages, { role: "assistant", text: reply }]);
    } catch (error) {
      setMessages([...nextMessages, { role: "assistant", text: getClientErrorMessage(error) }]);
    } finally {
      setIsSending(false);
    }
  }

  return h(
    "section",
    { className: "chat-page" },
    h("header", { className: "chat-header" }, h("button", { type: "button", onClick: onBack, "aria-label": "Back to analytics" }, h(Icon, { name: "chevron-left" })), h("span", null, h("strong", null, "Melius"), h("small", null, "qwen3.7-plus recovery assistant"))),
    h("div", { className: "chat-thread" },
      messages.length === 0 ? h("div", { className: "empty-chat" }, h("strong", null, "What feels hardest right now?"), h("p", null, "Tell Melius about the urge, trigger, or relapse risk. It will help you get through the next few minutes.")) : null,
      messages.map((message, index) => h("p", { key: index, className: `chat-bubble ${message.role}` }, message.text)),
      isSending ? h("p", { className: "chat-bubble assistant is-thinking" }, "Melius is thinking...") : null
    ),
    h("form", { className: "chat-composer", onSubmit: sendMessage }, h("input", { value: draft, onChange: (event) => setDraft(event.target.value), placeholder: "Message Melius..." }), h("button", { type: "submit", disabled: isSending || !draft.trim(), "aria-label": "Send" }, h(Icon, { name: "send" })))
  );
}

function BottomNav({ page, onNavigate }) {
  const navItems = [
    { label: "Home", icon: "home", page: "home" },
    { label: "Community", icon: "chat", page: "community" },
    { label: "Stats", icon: "stats", page: "analytics" },
    { label: "Library", icon: "folder", page: "library" },
    { label: "Profile", icon: "profile", page: "profile" }
  ];

  return h("nav", { className: "bottom-nav", "aria-label": "Main navigation" }, navItems.map((item) =>
    h("button", { key: item.label, className: page === item.page ? "nav-button is-active" : "nav-button", type: "button", "aria-label": item.label, onClick: () => onNavigate(item.page) }, h(Icon, { name: item.icon }))
  ));
}

function Milestone({ item, onAction }) {
  const stateClass = item.current ? "is-current" : item.complete ? "is-complete" : "is-locked";
  const className = `milestone day-badge ${stateClass}`;

  return h(
    "button",
    {
      className,
      type: "button",
      onClick: () => onAction(`day ${item.day}`),
      "aria-label": `${item.name}, day ${item.day}${item.current ? ", current" : item.complete ? ", complete" : ", locked"}`
    },
    h("span", { className: "planet", style: item.style },
      h("span", { className: "milestone-day" }, item.day)
    ),
    h("strong", null, item.name),
    h("small", null, item.days)
  );
}

function StatCard({ item, onAction }) {
  return h("button", { className: "stat-card", type: "button", onClick: () => onAction(item.label.toLowerCase()) }, h("span", { className: `stat-icon ${item.icon}` }, h(Icon, { name: item.icon })), h("span", { className: "stat-label" }, item.label), h("strong", null, item.value));
}

function QuickAction({ item, onAction }) {
  return h("button", { className: item.active ? "quick-action is-active" : "quick-action", type: "button", onClick: () => onAction(item.action) }, h("span", { className: "quick-orb" }, h(Icon, { name: item.icon })), h("span", { className: "quick-label" }, item.label));
}

function ProgressPill({ onAction }) {
  return h("button", { className: "progress-pill", type: "button", onClick: () => onAction("brain rewiring") }, h("span", null, "Brain Rewiring"), h("span", { className: "progress-track" }, h("span", { className: "progress-bar" })), h("strong", null, "0%"));
}

function FeatureCard({ card, onAction, journalEntries = [] }) {
  const isJournal = Boolean(card.buttonLabel);
  const latestEntry = isJournal ? journalEntries[0] : null;
  const entryCount = isJournal ? journalEntries.length : 0;

  return h(
    "article",
    { className: isJournal ? "feature-card journal-card" : "feature-card" },
    h("button", { className: "feature-main", type: "button", onClick: () => onAction(card.action) },
      h("span", { className: `feature-icon ${card.accent}` }, h(Icon, { name: card.icon })),
      h("span", { className: "feature-copy" },
        h("span", { className: "feature-title-row" }, h("strong", null, card.title), card.pill ? h("em", null, card.pill) : null),
        card.heading ? h("b", null, latestEntry ? "Today's Reflection" : card.heading) : null,
        latestEntry ? h("span", { className: "journal-preview" }, h("strong", null, latestEntry.title), h("small", null, latestEntry.body || "No details yet")) : h("small", null, card.subtitle)
      ),
      card.badge ? h("span", { className: "badge" }, entryCount || card.badge) : h("span", { className: "chevron" }, h(Icon, { name: "chevron" }))
    ),
    card.buttonLabel ? h("button", { className: "entry-button", type: "button", onClick: () => onAction("new entry") }, h(Icon, { name: "edit" }), h("span", null, card.buttonLabel)) : null
  );
}

function QuoteBlock() {
  return h("section", { className: "quote-block" }, h("span", { className: "quote-mark" }, "\""), h("p", null, "Today marks the beginning of a powerful journey. This decision is a commitment to a better you. Remember, small steps lead to great changes."), h("span", { className: "quote-mark closing" }, "\""));
}

function PledgeModal({ onClose, onAction }) {
  return h("section", { className: "modal-backdrop", role: "dialog", "aria-modal": "true", "aria-label": "Pledge" }, h("div", { className: "pledge-modal" }, h("button", { className: "modal-close", type: "button", "aria-label": "Close pledge dialog", onClick: onClose }, h(Icon, { name: "close" })), h("h2", { className: "modal-title" }, "Pledge"), h("div", { className: "pledge-hero" }, h("span", { className: "pledge-hand" }, h(Icon, { name: "hand" }))), h("div", { className: "pledge-copy" }, h("h3", null, "Pledge Sobriety Today"), h("p", null, "Make a commitment to yourself not to masturbate for today. You'll receive a notification in 24 hours to check in and see how you did.")), h("section", { className: "pledge-benefits" }, pledgeBenefits.map((item) => h(PledgeBenefit, { key: item.title, item }))), h("button", { className: "pledge-cta", type: "button", onClick: () => onAction("pledge confirm") }, "Pledge Now")));
}

function PledgeBenefit({ item }) {
  return h("article", { className: "pledge-benefit" }, h("span", { className: `pledge-benefit-icon ${item.tone}` }, h(Icon, { name: item.icon })), h("span", { className: "pledge-benefit-copy" }, h("strong", null, item.title), h("small", null, item.description)));
}

function createUrgeFlow() {
  return {
    step: "intensity",
    progress: 20,
    intensityValue: 50,
    intensityLabel: "Medium",
    intensityOptions: ["Mild", "Medium", "Strong", "Max"].map((label) => ({ label })),
    context: "",
    contextOptions: ["Bedroom", "Bathroom", "Living Room", "Work", "School", "Car", "Outside", "Other"],
    alone: null,
    response: "",
    responseOptions: [
      { title: "Deep Breathing", subtitle: "Calm your system", icon: "wind" },
      { title: "Exercise", subtitle: "Move your body", icon: "run" },
      { title: "Cold Shower", subtitle: "Reset your mind", icon: "drop" },
      { title: "Call Someone", subtitle: "Get support", icon: "phone" },
      { title: "Meditate", subtitle: "Center yourself", icon: "brain" },
      { title: "Go Outside", subtitle: "Change environment", icon: "leaf" },
      { title: "Journal", subtitle: "Put it into words", icon: "journal" }
    ],
    guidedActions: ["Deep Breathing", "Meditate"],
    savedAt: null
  };
}

function stepUrgeFlow(flow, event) {
  if (!flow) return flow;

  const next = { ...flow };
  if (event === "back") {
    if (next.step === "context") next.step = "intensity";
    else if (next.step === "ground") next.step = "context";
    else if (next.step === "response") next.step = "ground";
    else if (next.step === "guided") next.step = "response";
    next.progress = Math.max(20, next.progress - 20);
    return next;
  }

  if (event === "continue") {
    if (next.step === "intensity") {
      next.step = "context";
      next.progress = 40;
    } else if (next.step === "context") {
      next.step = "ground";
      next.progress = 60;
    } else if (next.step === "ground") {
      next.step = "response";
      next.progress = 80;
    } else if (next.step === "guided") {
      next.step = "logged";
      next.progress = 100;
    }
    return next;
  }

  if (event.startsWith("intensity ")) {
    const value = event.slice("intensity ".length);
    const known = ["Mild", "Medium", "Strong", "Max"].includes(value) ? value : next.intensityLabel;
    next.intensityLabel = known;
    next.intensityValue = { Mild: 20, Medium: 50, Strong: 75, Max: 95 }[known] || 50;
    return next;
  }

  if (event.startsWith("intensity value ")) {
    const value = Number(event.slice("intensity value ".length));
    next.intensityValue = value;
    next.intensityLabel = value < 35 ? "Mild" : value < 65 ? "Medium" : value < 85 ? "Strong" : "Max";
    return next;
  }

  if (event.startsWith("context ")) {
    next.context = event.slice("context ".length);
    return next;
  }

  if (event === "alone yes") {
    next.alone = true;
    return next;
  }

  if (event === "alone no") {
    next.alone = false;
    return next;
  }

  if (event.startsWith("response ")) {
    next.response = event.slice("response ".length);
    return next;
  }

  if (event === "guided") {
    next.step = "guided";
    next.progress = 90;
    return next;
  }

  return next;
}

async function recordUrgeLog(flow) {
  const response = await fetch(URGE_LOG_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      intensity: flow?.intensityLabel || "",
      intensityValue: flow?.intensityValue || 0,
      context: flow?.context || "",
      alone: flow?.alone,
      response: flow?.response || "",
      savedAt: flow?.savedAt
    })
  });
  if (!response.ok) throw new Error("Urge log request failed");
  return response.json();
}

async function loadJournalEntries() {
  const response = await fetch(JOURNAL_ENDPOINT);
  if (!response.ok) throw new Error("Journal request failed");
  const data = await response.json();
  return data.entries || [];
}

async function createJournalEntry(entry) {
  const response = await fetch(JOURNAL_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry)
  });
  if (!response.ok) throw new Error("Journal save failed");
  return response.json();
}

async function loadReasons() {
  const response = await fetch(REASONS_ENDPOINT);
  if (!response.ok) throw new Error("Reasons request failed");
  const data = await response.json();
  return data.reasons || [];
}

async function updateReasons(reasons) {
  const response = await fetch(REASONS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reasons })
  });
  if (!response.ok) throw new Error("Reasons save failed");
  return response.json();
}

async function loadAnalytics() {
  const response = await fetch(ANALYTICS_ENDPOINT);
  if (!response.ok) throw new Error("Analytics request failed");
  const data = await response.json();
  return withClientLoadedAt(data);
}

async function recordRelapse(review = createResetReview()) {
  const response = await fetch(RELAPSE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reflection: review, triggers: review.triggers || [] })
  });
  if (!response.ok) throw new Error("Relapse request failed");
  return response.json();
}

async function loadBlockerState() {
  const response = await fetch(BLOCKER_STATE_ENDPOINT);
  if (!response.ok) throw new Error("Blocker state request failed");
  return response.json();
}

async function toggleBlockerProtection(enabled) {
  const response = await fetch(BLOCKER_PROTECTION_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled })
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Protection toggle failed");
  }
  return response.json();
}

async function toggleBlockerTier1(enabled) {
  const response = await fetch(BLOCKER_TIER1_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled })
  });
  if (!response.ok) throw new Error("Tier 1 toggle failed");
  return response.json();
}

async function loadBlockerWebsites() {
  const response = await fetch(BLOCKER_WEBSITES_ENDPOINT);
  if (!response.ok) throw new Error("Websites request failed");
  const data = await response.json();
  return data.websites || [];
}

async function addBlockerWebsite(domain) {
  const response = await fetch(BLOCKER_WEBSITES_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ website: domain })
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Add website failed");
  }
  return response.json();
}

async function removeBlockerWebsite(domain) {
  const response = await fetch(BLOCKER_WEBSITES_REMOVE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ website: domain })
  });
  if (!response.ok) throw new Error("Remove website failed");
  return response.json();
}

async function toggleBlockerTier2(enabled) {
  const response = await fetch(BLOCKER_TIER2_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled })
  });
  if (!response.ok) throw new Error("Tier 2 toggle failed");
  return response.json();
}

async function loadBlockerApps() {
  const response = await fetch(BLOCKER_APPS_ENDPOINT);
  if (!response.ok) throw new Error("Apps request failed");
  const data = await response.json();
  return data.apps || [];
}

async function addBlockerApp(appId) {
  const response = await fetch(BLOCKER_APPS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appId })
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Add app failed");
  }
  return response.json();
}

async function removeBlockerApp(appId) {
  const response = await fetch(BLOCKER_APPS_REMOVE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appId })
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Remove app failed");
  }
  return response.json();
}

async function enableBlockerTier3(passcode) {
  const response = await fetch(BLOCKER_TIER3_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ passcode })
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Permanent lock failed");
  }
  return response.json();
}

async function unlockBlockerTier3(passcode) {
  const response = await fetch(BLOCKER_TIER3_UNLOCK_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ passcode })
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Unlock failed");
  }
  return response.json();
}

async function loadBlockerScreenTime() {
  const response = await fetch(BLOCKER_SCREENTIME_ENDPOINT);
  if (!response.ok) throw new Error("Screen time request failed");
  return response.json();
}

async function loadCommunityPosts(filter) {
  const url = filter ? `${COMMUNITY_POSTS_ENDPOINT}?filter=${filter}` : COMMUNITY_POSTS_ENDPOINT;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Community posts request failed");
  const data = await response.json();
  return data.posts || [];
}

async function loadCommunityPost(id) {
  const response = await fetch(`${COMMUNITY_POST_ENDPOINT}?id=${encodeURIComponent(id)}`);
  if (!response.ok) throw new Error("Post request failed");
  return response.json();
}

async function createCommunityPost(title, body) {
  const response = await fetch(COMMUNITY_POSTS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, body })
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Create post failed");
  }
  return response.json();
}

async function addCommunityComment(postId, text) {
  const response = await fetch(COMMUNITY_COMMENT_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ postId, text })
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Comment failed");
  }
  return response.json();
}

async function toggleCommunityLike(postId) {
  const response = await fetch(COMMUNITY_LIKE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ postId })
  });
  if (!response.ok) throw new Error("Like failed");
  return response.json();
}

function createResetReview() {
  return resetReflectionGroups.reduce((review, group) => {
    review[group.key] = [];
    return review;
  }, {});
}

function toggleResetReviewOption(review, groupKey, option) {
  if (!resetReflectionGroups.some((group) => group.key === groupKey)) {
    return review;
  }

  const current = Array.isArray(review[groupKey]) ? review[groupKey] : [];
  const nextValues = current.includes(option)
    ? current.filter((item) => item !== option)
    : [...current, option];

  return {
    ...review,
    [groupKey]: nextValues
  };
}

function getResetSelectionCount(review) {
  return resetReflectionGroups.reduce((count, group) => {
    const values = Array.isArray(review[group.key]) ? review[group.key] : [];
    return count + values.length;
  }, 0);
}

async function sendMeliusMessage(messages) {
  const response = await fetch(MELIUS_CHAT_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Melius is unavailable.");
  }
  return data.reply || "";
}

function getClientErrorMessage(error) {
  return error?.message || "Melius is unavailable right now. Try again in a moment.";
}

function normalizeChartPoints(points, width, height) {
  const items = points && points.length ? points : [{ id: 1, days: 0, type: "progress" }];
  const max = Math.max(1, ...items.map((item) => Number(item.days) || 0));
  return items.map((item, index) => ({
    ...item,
    x: 20 + (index / Math.max(1, items.length - 1)) * (width - 40),
    y: 172 - ((Number(item.days) || 0) / max) * (height - 42)
  }));
}

function createDayMilestones(currentDay) {
  return Array.from({ length: 90 }, (_, index) => {
    const day = index + 1;
    const palette = milestonePalettes[index % milestonePalettes.length];
    const phase = Math.floor(index / 10);

    return {
      day,
      name: getMilestoneName(day),
      days: `Day ${day}`,
      complete: day <= currentDay,
      current: day === currentDay,
      style: {
        "--base-a": palette[0],
        "--base-b": palette[1],
        "--base-c": palette[2],
        "--planet-glow": palette[3],
        "--planet-ring": phase % 2 === 0 ? "rgba(255, 255, 255, 0.18)" : "rgba(255, 255, 255, 0.08)",
        "--planet-tilt": `${(day * 23) % 360}deg`
      }
    };
  });
}

function getCurrentMilestoneDay(analytics) {
  if (!analytics) {
    return 0;
  }

  const days = Number(analytics.currentStreakDays);
  if (!Number.isFinite(days) || days <= 0) {
    return 0;
  }
  return Math.min(90, Math.max(1, Math.floor(days)));
}

function getMilestoneName(day) {
  return milestoneNames[(day - 1) % milestoneNames.length];
}

function createCalendarMonthCells(monthDate) {
  const month = startOfCalendarMonth(monthDate);
  const firstWeekday = month.getDay();
  const lastDate = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const totalCells = Math.ceil((firstWeekday + lastDate) / 7) * 7;

  return Array.from({ length: totalCells }, (_, index) => {
    const dayNumber = index - firstWeekday + 1;
    if (dayNumber < 1 || dayNumber > lastDate) {
      return { key: `empty-${index}`, date: null };
    }

    const date = new Date(month.getFullYear(), month.getMonth(), dayNumber);
    return { key: getCalendarDateKey(date), date };
  });
}

function getCalendarDayStatus(date, data, today) {
  const relapseKeys = new Set((data.relapses || []).map((item) => {
    const relapseDate = parseCalendarDate(item);
    return relapseDate ? getCalendarDateKey(relapseDate) : "";
  }).filter(Boolean));
  const dateKey = getCalendarDateKey(date);

  if (relapseKeys.has(dateKey)) {
    return "relapse";
  }

  const startedAt = parseCalendarDate(data.startedAt || data.currentStreakStartAt);
  const startKey = startedAt ? getCalendarDateKey(startedAt) : "";
  const todayKey = getCalendarDateKey(today);
  if (startKey && dateKey >= startKey && dateKey <= todayKey) {
    return "clean";
  }

  return "no-data";
}

function getCalendarStreakDayCount(data, today, nowMs = Date.now()) {
  const baseMs = Number(data.currentStreakMs);
  const loadedAtMs = Number(data.loadedAtClientMs || nowMs);
  const currentDays = Number.isFinite(baseMs)
    ? (baseMs + Math.max(0, nowMs - loadedAtMs)) / CALENDAR_DAY_MS
    : Number(data.currentStreakDays);

  if (Number.isFinite(currentDays)) {
    return Math.max(0, Math.round(currentDays));
  }

  const currentStart = parseCalendarDate(data.currentStreakStartAt);
  if (currentStart) {
    const diff = getCalendarDayIndex(today) - getCalendarDayIndex(currentStart);
    return Math.max(0, diff);
  }

  return 0;
}

function getCalendarStatusLabel(status) {
  if (status === "clean") return "Clean";
  if (status === "relapse") return "Relapse";
  return "No data";
}

function startOfCalendarMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfCalendarDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addCalendarMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function isSameCalendarDay(left, right) {
  return getCalendarDateKey(left) === getCalendarDateKey(right);
}

function getCalendarDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCalendarDayIndex(date) {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / CALENDAR_DAY_MS);
}

function parseCalendarDate(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function formatCalendarMonth(date) {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function formatCalendarDate(date) {
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function createHomeStats(analytics, nowMs) {
  if (!analytics) {
    return fallbackStats;
  }

  const streakValue = Number.isFinite(Number(analytics.currentStreakMs))
    ? formatDurationFromMs(Number(analytics.currentStreakMs) + Math.max(0, nowMs - Number(analytics.loadedAtClientMs || nowMs)))
    : analytics.currentStreakClockLabel || analytics.currentStreakLabel || "0m";

  return [
    { label: "Goal", value: `${analytics.soberGoalDays || 90}d`, icon: "diamond" },
    { label: "Streak", value: streakValue, icon: "streak" },
    { label: "Til Sober", value: analytics.soberGoalRemainingLabel || "90d", icon: "bars" }
  ];
}

function withClientLoadedAt(data) {
  return { ...data, loadedAtClientMs: Date.now() };
}

function formatDurationFromMs(ms) {
  const totalMinutes = Math.max(0, Math.floor(ms / (60 * 1000)));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function createFallbackAnalytics() {
  const now = new Date();
  const day = CALENDAR_DAY_MS;
  const relapses = [31, 30, 27, 19, 12, 7].map((daysAgo) => new Date(now.getTime() - daysAgo * day).toISOString());

  return {
    startedAt: new Date(now.getTime() - 34 * day).toISOString(),
    generatedAt: now.toISOString(),
    currentStreakStartAt: relapses[relapses.length - 1],
    currentStreakMs: 7 * day,
    currentStreakDays: 7,
    currentStreakLabel: "7d",
    relapses,
    progressPoints: [{ id: 1, days: 8, type: "relapse" }, { id: 2, days: 1, type: "relapse" }, { id: 3, days: 4, type: "relapse" }, { id: 4, days: 2, type: "relapse" }, { id: 5, days: 7, type: "progress" }],
    streaks: [{ id: 1, days: 1, relapseAt: true }, { id: 2, days: 0.5, relapseAt: true }, { id: 3, days: 3, relapseAt: true }, { id: 4, days: 0.7, relapseAt: true }, { id: 5, days: 8, relapseAt: true }, { id: 6, days: 0.4, relapseAt: true }, { id: 7, days: 7, relapseAt: null, current: true }],
    stats: { bestStreakLabel: "8d", avgStreakLabel: "3d", relapseCount: 6, rankPercent: 40, karma: 1 },
    encouragement: { title: "One Week Strong!", body: "A full week is a major milestone. Your brain is beginning to heal. You might notice improved focus and energy. This is just the beginning." }
  };
}

function Icon({ name }) {
  const icons = {
    bars: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M5 18h14v2H5v-2Zm1-7h4v5H6v-5Zm6-5h4v10h-4V6Zm6 8h4v2h-4v-2Z" })),
    people: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3Zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3Zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5Zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5Z" })),
    breathe: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8Zm-5-6c0-2.76 2.24-5 5-5s5 2.24 5 5h2c0-3.86-3.14-7-7-7s-7 3.14-7 7h2Zm5-3c-1.66 0-3 1.34-3 3h2c0-.55.45-1 1-1s1 .45 1 1h2c0-1.66-1.34-3-3-3Z" })),
    block: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 3c1.4 0 2.8.4 3.9 1.2l-9.7 9.7A7 7 0 0 1 12 5Zm0 14a7 7 0 0 1-4-1.2l9.8-9.7A7 7 0 0 1 12 19Z" })),
    bolt: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M13 2 4 14h7l-1 8 10-13h-7l0-7Z" })),
    brain: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M8.2 3.7a4 4 0 0 1 6.5 1A4.7 4.7 0 0 1 21 9.1c0 2-.9 3.4-2.2 4.1.1.4.2.8.2 1.2A4.6 4.6 0 0 1 14.4 19H14a3.3 3.3 0 0 1-6.3.3A4.9 4.9 0 0 1 3 14.4c0-1 .3-2 .8-2.8A4.6 4.6 0 0 1 4 4.4a4.8 4.8 0 0 1 4.2-.7Z" })),
    chat: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M4 5.5A4.5 4.5 0 0 1 8.5 1h7A4.5 4.5 0 0 1 20 5.5v5.2a4.5 4.5 0 0 1-4.5 4.5H10l-5.5 4.1c-.8.6-1.9 0-1.9-1V5.5H4Z" })),
    chevron: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "m8.8 4.2 7.1 7.1c.4.4.4 1 0 1.4l-7.1 7.1-1.5-1.5 6.4-6.3-6.4-6.3 1.5-1.5Z" })),
    "chevron-left": h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "m15.2 4.2 1.5 1.5-6.4 6.3 6.4 6.3-1.5 1.5-7.1-7.1a1 1 0 0 1 0-1.4l7.1-7.1Z" })),
    check: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "m9.2 16.2-4-4L3.8 13.6l5.4 5.4L20.7 7.5l-1.4-1.4-10.1 10.1Z" })),
    "check-circle": h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.8 7.5-5.4 6.8a1 1 0 0 1-1.5.1l-2.8-2.7 1.4-1.4 2 2 4.7-5.9 1.6 1.1Z" })),
    close: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M18.3 4.3 12 10.6 5.7 4.3 4.3 5.7l6.3 6.3-6.3 6.3 1.4 1.4 6.3-6.3 6.3 6.3 1.4-1.4-6.3-6.3 6.3-6.3-1.4-1.4Z" })),
    comment: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M5 4h14a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-8l-5 4v-4H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Zm0 2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h3v2l2.4-2H19a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1H5Z" })),
    crown: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M3 18h18v2H3v-2Zm1.5-11 4.4 3.8L12 4l3.1 6.8L19.5 7 21 16H3L4.5 7Z" })),
    diamond: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "m12 3 7 9-7 9-7-9 7-9Z" })),
    dot: h("svg", { viewBox: "0 0 24 24" }, h("circle", { cx: "12", cy: "12", r: "5" })),
    edit: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M5 17.5V20h2.5L18.8 8.7l-2.5-2.5L5 17.5Z" })),
    folder: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M3 6.5A2.5 2.5 0 0 1 5.5 4H10l2 2h6.5A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-10Z" })),
    gear: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "m19.4 13.5 2.1 1.6-2 3.5-2.6-1a7.6 7.6 0 0 1-1.8 1l-.4 2.8h-4l-.4-2.8a7 7 0 0 1-1.8-1l-2.6 1-2-3.5L6 13.5a7.6 7.6 0 0 1 0-2.1L3.9 9.8l2-3.5 2.6 1c.6-.4 1.2-.7 1.8-1l.4-2.8h4l.4 2.8c.7.2 1.3.6 1.8 1l2.6-1 2 3.5-2.1 1.6a7.6 7.6 0 0 1 0 2.1ZM12.7 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" })),
    gift: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M20 8h-2.2A3.4 3.4 0 0 0 12 4.7 3.4 3.4 0 0 0 6.2 8H4a2 2 0 0 0-2 2v3h2v8h16v-8h2v-3a2 2 0 0 0-2-2ZM9.5 6a1.5 1.5 0 0 1 1.4 2H8.5A1.5 1.5 0 0 1 9.5 6Zm5 0a1.5 1.5 0 0 1 1 2h-2.4A1.5 1.5 0 0 1 14.5 6ZM6 13h5v6H6v-6Zm7 6v-6h5v6h-5Z" })),
    hand: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M12 3a1.5 1.5 0 0 1 1.5 1.5V12h1V6a1.5 1.5 0 0 1 3 0v6h1V8a1.5 1.5 0 0 1 3 0v5.4A7.6 7.6 0 0 1 14 21h-1.1a8 8 0 0 1-5.7-2.4L3 14.4c-.7-.7-.7-1.9 0-2.6.7-.7 1.8-.7 2.5-.1L8 14.1V5.5a1.5 1.5 0 0 1 3 0V12h1V4.5A1.5 1.5 0 0 1 12 3Z" })),
    leaf: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M20 4c-8.2 0-14 4.9-14 11a5 5 0 0 0 5 5c6.1 0 11-5.8 11-14V4h-2Zm-3 3c-2.7 1.3-6 4.7-8 8.2V15c0-3.6 3.3-6.8 8-8Zm-8 8.5c1.2-1.7 3.2-3.8 5.3-5.3-2.8 2.1-5 4.8-5.3 5.3Z" })),
    heart: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M12 21s-8-4.8-8-11a4.8 4.8 0 0 1 8-3.5A4.8 4.8 0 0 1 20 10c0 6.2-8 11-8 11Z" })),
    "heart-outline": h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M12 21s-8-4.8-8-11a4.8 4.8 0 0 1 8-3.5A4.8 4.8 0 0 1 20 10c0 6.2-8 11-8 11Zm0-2.4c2-1.4 6-4.8 6-8.6a2.8 2.8 0 0 0-4.7-2.1L12 9.1l-1.3-1.2A2.8 2.8 0 0 0 6 10c0 3.8 4 7.2 6 8.6Z" })),
    home: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "m12 2 9 7.6V21h-6v-6H9v6H3V9.6L12 2Z" })),
    journal: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M6 3h11a2 2 0 0 1 2 2v16H7a3 3 0 0 1-3-3V5a2 2 0 0 1 2-2Z" })),
    letters: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M4 19 9.4 5h2.3L17 19h-2.3l-1.1-3H7.4l-1.1 3H4Zm4.1-5h4.8l-2.4-6.5L8.1 14ZM18 6h3v13h-2V8h-1V6Z" })),
    lock: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M7 10V8a5 5 0 0 1 10 0v2h1a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h1Zm2 0h6V8a3 3 0 0 0-6 0v2Z" })),
    meditate: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M12 6a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm-2 2-4 3 1.2 1.6L10 10.5V14l-5 4 1.2 1.6L12 15l5.8 4.6L19 18l-5-4v-3.5l2.8 2.1L18 11l-4-3h-4Zm-8 13h20v2H2v-2Z" })),
    melius: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M9 3a7 7 0 0 1 6.8 8.8A6 6 0 1 1 12.2 22a6.9 6.9 0 0 1-2.7-4H9A7.5 7.5 0 0 1 9 3Zm8.5 11a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" })),
    music: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M15 3h4v12.5A3.5 3.5 0 1 1 17 12.3V7h-4v10.5A3.5 3.5 0 1 1 11 14.3V3h4Z" })),
    note: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M6 3h12v18H6V3Zm2 2v14h8V5H8Z" })),
    play: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M8 5v14l11-7L8 5Z" })),
    pause: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M6 4h4v16H6V4Zm8 0h4v16h-4V4Z" })),
    "plus-circle": h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Zm1-4a11 11 0 1 0 0 22 11 11 0 0 0 0-22Zm0 2a9 9 0 1 1 0 18 9 9 0 0 1 0-18Z" })),
    profile: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.4 0-8 2.7-8 6v2h16v-2c0-3.3-3.6-6-8-6Z" })),
    phone: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M6.6 2.8 9 5.2c.7.7.8 1.8.2 2.6L7.9 9.3a16 16 0 0 0 6.8 6.8l1.5-1.3a2 2 0 0 1 2.6.2l2.4 2.4a2 2 0 0 1 0 2.8l-1.3 1.3c-1.1 1.1-2.7 1.6-4.2 1.2C8.6 21.7 2.3 15.4 1.2 7.4c-.4-1.5.1-3.1 1.2-4.2l1.3-1.3a2 2 0 0 1 2.9 0Z" })),
    run: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M13 3.5a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4Zm-1.4 5L8.2 10l-2 5.7 2 .7 1.6-4.6 2.2-.8 2.1 2.1-1.1 3.9h2.1l1.5-4.8-3.2-3.2a2 2 0 0 0-1.8-.5Z" })),
    drop: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M12 2c4.8 5.6 7 8.9 7 12a7 7 0 1 1-14 0c0-3.1 2.2-6.4 7-12Z" })),
    wind: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M3 8h11a3 3 0 1 0-3-3h2a1 1 0 1 1 1 1H3v2Zm0 5h15a3 3 0 1 1-3 3h2a1 1 0 1 0 1-1H3v-2Zm0 5h8v2H3v-2Z" })),
    search: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M10.5 3a7.5 7.5 0 0 1 5.9 12.1l4.2 4.2-1.4 1.4-4.2-4.2A7.5 7.5 0 1 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z" })),
    send: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M2 21 23 12 2 3v7l12 2-12 2v7Z" })),
    share: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M13 3v8h-2V3L7.8 6.2 6.4 4.8 12 0l5.6 4.8-1.4 1.4L13 3ZM5 9h4v2H6v9h12v-9h-3V9h4a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1Z" })),
    sparkles: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "m12 2 1.7 4.8L18.5 8l-4.8 1.2L12 14l-1.7-4.8L5.5 8l4.8-1.2L12 2Z" })),
    stats: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M4 13h4v8H4v-8Zm6-10h4v18h-4V3Zm6 6h4v12h-4V9Z" })),
    streak: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M7 14.5a5 5 0 0 0 10 0c0-1.7-.8-3.2-2.4-4.7-.2 1-.9 1.7-1.9 2.3.2-2.4-.7-4.6-2.7-6.6.2 2.5-.7 4.4-2.5 5.7A4.5 4.5 0 0 0 7 14.5Z" })),
    therapy: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M8 9h3.2l2.1 2.1a2 2 0 0 0 2.8 0L19 8.2 17.6 6.8 14.7 9.7 12 7H8v2Z" })),
    tree: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "m12 2 6 8h-3l4 6h-5v5h-4v-5H5l4-6H6l6-8Z" })),
    undo: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M9 7V3L2 10l7 7v-4h5.5A4.5 4.5 0 1 1 14.5 4H13V2h1.5a6.5 6.5 0 1 1 0 13H7V7h2Z" })),
    warning: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M12 3 1.5 21h21L12 3Zm1 14h-2v2h2v-2Zm0-7h-2v6h2v-6Z" })),
    power: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M13 3h-2v10h2V3Zm5.3 3.3-1.4 1.4a7 7 0 1 1-7.8 0L7.7 6.3a9 9 0 1 0 10.6 0Z" })),
    hourglass: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M6 2v6l4 4-4 4v6h12v-6l-4-4 4-4V2H6Zm10 16v2H8v-2l4-4 4 4Zm0-12v2l-4 4-4-4V4h8Z" })),
    monitor: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M3 5h18v12H3V5Zm2 2v8h14V7H5Zm-2 12h18v2H3v-2Z" })),
    info: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 5h-2v2h2V7Zm0 4h-2v6h2v-6Z" })),
    shield: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Z" })),
    trash: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M6 7h12v2H6V7Zm2-3h8v2H8V4ZM7 9h10l-1 12H8L7 9Z" })),
    eye: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M12 5C7 5 3 8 1 12c2 4 6 7 11 7s9-3 11-7c-2-4-6-7-11-7Zm0 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z" })),
    "eye-off": h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M2 4.2 3.2 3l17.8 17.8-1.2 1.2-3-3a11 11 0 0 1-4.8 1c-5 0-9-3-11-7a12 12 0 0 1 3.4-4.2L2 4.2ZM12 9a3 3 0 0 0 3 3l-3-3Zm0-4c5 0 9 3 11 7a12 12 0 0 1-2.5 3.3l-2-2A4 4 0 0 0 9 9.5l-2.4-2.4A11 11 0 0 1 12 5Z" })),
    globe: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 2c1.2 0 3 2.5 3 8s-1.8 8-3 8-3-2.5-3-8 1.8-8 3-8Zm-7.6 5a8 8 0 0 1 3-3.3A14 14 0 0 0 7 12a14 14 0 0 0 .4 6.3 8 8 0 0 1-3-3.3C3.5 13 3.5 11 4.4 9Zm15.2 6a8 8 0 0 1-3 3.3A14 14 0 0 0 17 12a14 14 0 0 0-.4-6.3 8 8 0 0 1 3 3.3c.9 2 .9 4 0 6Z" })),
    bell: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M12 2a7 7 0 0 1 7 7v4l2 3H3l2-3V9a7 7 0 0 1 7-7Zm0 20a3 3 0 0 0 3-3H9a3 3 0 0 0 3 3Z" })),
    "chevron-down": h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M4.2 8.8 11 15.6l6.8-6.8 1.5 1.5L11 18.6 2.7 10.3l1.5-1.5Z" })),
    plus: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z" })),
    more: h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M12 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm0 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm0 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" }))
  };
  return icons[name] || null;
}

function launchConfettiBurst() {
  const existingLayer = document.querySelector(".confetti-layer");
  if (existingLayer) existingLayer.remove();
  const layer = document.createElement("div");
  layer.className = "confetti-layer";
  layer.setAttribute("aria-hidden", "true");
  for (const piece of confettiPieces) {
    const node = document.createElement("span");
    node.className = `confetti-piece ${piece.shape}`;
    node.style.left = "50%";
    node.style.top = "58%";
    node.style.animationDelay = piece.delay;
    node.style.animationDuration = piece.duration;
    node.style.background = piece.color;
    node.style.boxShadow = `0 0 14px ${piece.color}66`;
    node.style.setProperty("--confetti-x", piece.x);
    node.style.setProperty("--confetti-y", piece.y);
    node.style.setProperty("--confetti-rotate", piece.rotate);
    layer.appendChild(node);
  }
  document.body.appendChild(layer);
  window.clearTimeout(launchConfettiBurst.timer);
  launchConfettiBurst.timer = window.setTimeout(() => layer.remove(), 2600);
}

function titleCase(value) {
  return value.split(" ").map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`).join(" ");
}

function ResetActionPage({ selected, onAction }) {
  return h(
    "section",
    { className: "reset-action-page" },
    h("div", { className: "reset-action-progress", "aria-hidden": "true" }, h("span", { style: { width: "75%" } })),
    h("header", { className: "reset-action-header" },
      h("div", { className: "reset-trigger-logo", "aria-hidden": "true" }, "QUITTR"),
      h("h1", null, "Now, do one thing for yourself")
    ),
    h("section", { className: "reset-action-list", "aria-label": "Self-care actions" },
      resetActionOptions.map((item) =>
        h(
          "button",
          {
            key: item.action,
            className: selected === item.action ? "reset-action-card is-selected" : "reset-action-card",
            type: "button",
            onClick: () => onAction(`reset action ${item.action}`)
          },
          h("span", { className: "reset-action-icon" }, h(Icon, { name: item.icon })),
          h("span", { className: "reset-action-copy" },
            h("strong", null, item.title),
            h("small", null, item.subtitle)
          ),
          h("span", { className: "reset-action-chevron" }, h(Icon, { name: "chevron" }))
        )
      )
    ),
    h("button", { className: "reset-action-continue", type: "button", onClick: () => onAction("reset action continue") },
      h("span", null, "Continue"),
      h(Icon, { name: "chevron" })
    )
  );
}

function ResetCommitPage({ onAction }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.strokeStyle = "#b338ee";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  function getCoords(event) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const touch = event.touches ? event.touches[0] : event;
    return {
      x: (touch.clientX - rect.left) * (canvas.width / rect.width),
      y: (touch.clientY - rect.top) * (canvas.height / rect.height)
    };
  }

  function startDraw(event) {
    event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const { x, y } = getCoords(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  }

  function draw(event) {
    event.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const { x, y } = getCoords(event);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  }

  function endDraw() {
    setIsDrawing(false);
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  }

  return h(
    "section",
    { className: "reset-commit-page" },
    h("div", { className: "reset-commit-progress", "aria-hidden": "true" }, h("span", { style: { width: "88%" } })),
    h("header", { className: "reset-commit-header" },
      h("div", { className: "reset-trigger-logo", "aria-hidden": "true" }, "QUITTR"),
      h("h1", null, "I commit to staying clean for the next 24 hours")
    ),
    h("div", { className: "reset-commit-canvas-wrap" },
      h("canvas", {
        ref: canvasRef,
        className: "reset-commit-canvas",
        width: 600,
        height: 260,
        onMouseDown: startDraw,
        onMouseMove: draw,
        onMouseUp: endDraw,
        onMouseLeave: endDraw,
        onTouchStart: startDraw,
        onTouchMove: draw,
        onTouchEnd: endDraw
      }),
      !hasSignature
        ? h("span", { className: "reset-commit-placeholder" }, "Sign here")
        : null
    ),
    h("div", { className: "reset-commit-actions-row" },
      h("button", { className: "reset-commit-clear", type: "button", onClick: clearSignature },
        h(Icon, { name: "undo" }),
        h("span", null, "Clear")
      )
    ),
    h("button", {
      className: "reset-commit-sign-link",
      type: "button"
    },
      h(Icon, { name: "journal" }),
      h("span", null, "Sign your commitment")
    ),
    h("button", {
      className: "reset-commit-continue",
      type: "button",
      disabled: !hasSignature,
      onClick: () => onAction("reset commit continue")
    },
      h("span", null, "Continue"),
      h(Icon, { name: "chevron" })
    )
  );
}

function ResetFinalPage({ onAction }) {
  return h(
    "section",
    { className: "reset-final-page" },
    h("div", { className: "reset-final-progress", "aria-hidden": "true" }, h("span", { style: { width: "100%" } })),
    h("div", { className: "reset-final-content" },
      h("p", { className: "reset-final-message" },
        "Logged. Be kind to yourself and focus on the next 10 minutes."
      )
    ),
    h("button", {
      className: "reset-final-button",
      type: "button",
      onClick: () => onAction("reset final continue")
    },
      h("span", null, "Done"),
      h(Icon, { name: "chevron" })
    )
  );
}

function RewireModal({ onAction }) {
  return h(
    "section",
    { className: "rewire-modal-backdrop", role: "dialog", "aria-modal": "true", "aria-label": "Rewire by Quittr" },
    h("div", { className: "rewire-modal" },
      h("div", { className: "rewire-modal-icon" }, h(Icon, { name: "hand" })),
      h("h2", null, "Struggle with lust?"),
      h("p", null, "Get personalized help quitting pornography from professionals."),
      h("button", {
        className: "rewire-modal-learn",
        type: "button",
        onClick: () => onAction("rewire modal learn")
      },
        h("span", null, "Learn More"),
        h(Icon, { name: "chevron" })
      ),
      h("button", {
        className: "rewire-modal-dismiss",
        type: "button",
        onClick: () => onAction("rewire modal close")
      }, "No Thanks")
    )
  );
}

createRoot(document.getElementById("root")).render(h(App));

const blockerAvailableApps = [
  { id: "safari", name: "Safari", category: "Browser" },
  { id: "chrome", name: "Chrome", category: "Browser" },
  { id: "youtube", name: "YouTube", category: "Entertainment" },
  { id: "instagram", name: "Instagram", category: "Social" },
  { id: "tiktok", name: "TikTok", category: "Social" },
  { id: "x", name: "X (Twitter)", category: "Social" },
  { id: "reddit", name: "Reddit", category: "Social" },
  { id: "snapchat", name: "Snapchat", category: "Social" },
  { id: "facebook", name: "Facebook", category: "Social" },
  { id: "twitch", name: "Twitch", category: "Entertainment" },
  { id: "netflix", name: "Netflix", category: "Entertainment" },
  { id: "discord", name: "Discord", category: "Communication" },
  { id: "telegram", name: "Telegram", category: "Communication" },
  { id: "whatsapp", name: "WhatsApp", category: "Communication" }
];

function ContentBlockerPage({ blockerState, setBlockerState, subview, onAction, showToast }) {
  const [isLoading, setIsLoading] = useState(!blockerState);
  const [isToggling, setIsToggling] = useState(false);

  useEffect(() => {
    if (!blockerState) {
      loadBlockerState().then((data) => { setBlockerState(data); setIsLoading(false); }).catch(() => { setIsLoading(false); showToast("Blocker unavailable"); });
    }
  }, []);

  async function handleProtectionToggle() {
    if (!blockerState || isToggling) return;
    if (blockerState.tier3 && blockerState.tier3.enabled && blockerState.protectionEnabled) {
      showToast("Permanent lock active — cannot turn off");
      return;
    }
    setIsToggling(true);
    try {
      const next = await toggleBlockerProtection(!blockerState.protectionEnabled);
      setBlockerState(next);
      showToast(next.protectionEnabled ? "Protection enabled" : "Protection disabled");
    } catch (err) {
      showToast(err.message || "Toggle failed");
    } finally {
      setIsToggling(false);
    }
  }

  if (subview === "tier1") {
    return h(BlockerTier1View, { blockerState, setBlockerState, onAction, showToast });
  }
  if (subview === "tier2") {
    return h(BlockerTier2View, { blockerState, setBlockerState, onAction, showToast });
  }
  if (subview === "tier3") {
    return h(BlockerTier3View, { blockerState, setBlockerState, onAction, showToast });
  }

  const isProtected = blockerState ? blockerState.protectionEnabled : false;
  const tier1On = blockerState && blockerState.tier1 ? blockerState.tier1.enabled : false;
  const tier2On = blockerState && blockerState.tier2 ? blockerState.tier2.enabled : false;
  const tier3On = blockerState && blockerState.tier3 ? blockerState.tier3.enabled : false;
  const blockedCount = blockerState && blockerState.tier1 ? (blockerState.tier1.presetDomains.length + (blockerState.tier1.customWebsites || []).length) : 0;
  const blockedAppCount = blockerState && blockerState.tier2 ? (blockerState.tier2.apps || []).length : 0;

  const screenTimeLabel = isProtected ? formatScreenTime(blockerState.screenTime) : "--";
  const pickupsLabel = isProtected && blockerState.screenTime ? String(blockerState.screenTime.pickups || 0) : "--";

  if (isLoading) {
    return h("section", { className: "blocker-page" },
      h("div", { className: "blocker-loading" }, "Loading...")
    );
  }

  return h(
    "section",
    { className: "blocker-page" },
    h("header", { className: "blocker-topbar" },
      h("button", { className: "blocker-back", type: "button", onClick: () => onAction("blocker back"), "aria-label": "Back" }, h(Icon, { name: "chevron-left" })),
      h("strong", null, "Content Blocker"),
      h("span", { className: "blocker-topbar-spacer" })
    ),
    h("section", { className: "blocker-status" },
      h("h1", { className: isProtected ? "blocker-status-title is-protected" : "blocker-status-title" }, isProtected ? "Protected." : "Not protected."),
      h("p", { className: "blocker-status-sub" }, isProtected ? "Your protection layers are active. Stay strong." : "Turn on the Website Blocker to start blocking adult content."),
      h("button", {
        className: isProtected ? "blocker-power-btn is-on" : "blocker-power-btn",
        type: "button",
        disabled: isToggling,
        onClick: handleProtectionToggle,
        "aria-label": isProtected ? "Turn off protection" : "Turn on protection"
      }, h(Icon, { name: "power" }))
    ),
    h("section", { className: "blocker-stats-row" },
      h("div", { className: "blocker-stat-card" },
        h("span", { className: "blocker-stat-icon blue" }, h(Icon, { name: "hourglass" })),
        h("strong", { className: "blocker-stat-value" }, screenTimeLabel),
        h("small", { className: "blocker-stat-label" }, "Screen time today")
      ),
      h("div", { className: "blocker-stat-card" },
        h("span", { className: "blocker-stat-icon orange" }, h(Icon, { name: "hand" })),
        h("strong", { className: "blocker-stat-value" }, pickupsLabel),
        h("small", { className: "blocker-stat-label" }, "Pickups")
      )
    ),
    h("h2", { className: "blocker-section-title" }, "PROTECTION LAYERS"),
    h("section", { className: "blocker-tier-list" },
      h(BlockerTierCard, {
        tier: 1,
        title: "Website Blocker",
        description: "Block all adult websites across every browser.",
        enabled: tier1On,
        count: blockedCount,
        countLabel: `${blockedCount} sites blocked`,
        onAction
      }),
      h(BlockerTierCard, {
        tier: 2,
        title: "App Blocker",
        description: "Block any apps you want to avoid — distracting apps, browsers, anything. Uses Apple Screen Time.",
        enabled: tier2On,
        count: blockedAppCount,
        countLabel: blockedAppCount > 0 ? `${blockedAppCount} apps blocked` : null,
        onAction
      }),
      h(BlockerTierCard, {
        tier: 3,
        title: "Permanent App Blocker",
        description: "Lock your blocked apps in. Can't be undone — that's the point.",
        enabled: tier3On,
        countLabel: tier3On ? "Locked" : null,
        onAction
      })
    ),
    h("section", { className: "blocker-info-banner" },
      h("span", { className: "blocker-info-icon" }, h(Icon, { name: "info" })),
      h("p", null, "App blocking and Screen Time features are only available on iPhone and iPad.")
    ),
    h("button", { className: "blocker-desktop-card", type: "button", onClick: () => onAction("blocker desktop") },
      h("span", { className: "blocker-desktop-icon" }, h(Icon, { name: "monitor" })),
      h("span", { className: "blocker-desktop-copy" },
        h("strong", null, "Desktop blocker"),
        h("small", null, "Install chrome extension")
      ),
      h("span", { className: "blocker-desktop-chevron" }, h(Icon, { name: "chevron" }))
    )
  );
}

function BlockerTierCard({ tier, title, description, enabled, count, countLabel, onAction }) {
  const active = enabled;
  return h(
    "button",
    { className: active ? "blocker-tier-card is-active" : "blocker-tier-card", type: "button", onClick: () => onAction(`blocker tier${tier}`) },
    h("span", { className: active ? "blocker-tier-dot is-active" : "blocker-tier-dot" }),
    h("span", { className: "blocker-tier-copy" },
      h("span", { className: "blocker-tier-label" }, `TIER ${tier}`),
      h("strong", { className: "blocker-tier-title" }, title),
      h("small", { className: "blocker-tier-desc" }, description),
      countLabel ? h("span", { className: "blocker-tier-count" }, countLabel) : null
    ),
    h("span", { className: "blocker-tier-chevron" }, h(Icon, { name: "chevron" }))
  );
}

function formatScreenTime(screenTime) {
  if (!screenTime || !screenTime.todayMinutes) return "0m";
  const minutes = screenTime.todayMinutes;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function BlockerTier1View({ blockerState, setBlockerState, onAction, showToast }) {
  const [isCompleting, setIsCompleting] = useState(false);
  const tier1 = blockerState && blockerState.tier1 ? blockerState.tier1 : { enabled: false };

  const setupSteps = [
    { num: 1, title: "Open Settings", rowIcon: "gear", rowText: "Settings" },
    { num: 2, title: "Tap General", rowIcon: "info", rowText: "General > VPN, DNS & Device" },
    { num: 3, title: "Enable QUITTR Protection", rowIcon: "shield", rowText: "QUITTR Protection" }
  ];

  async function handleDone() {
    setIsCompleting(true);
    try {
      const next = await toggleBlockerTier1(true);
      setBlockerState(next);
      showToast("Website Blocker enabled");
      onAction("blocker subview back");
    } catch (err) {
      showToast(err.message || "Setup failed");
    } finally {
      setIsCompleting(false);
    }
  }

  return h(
    "section",
    { className: "blocker-page blocker-dns-page" },
    h("header", { className: "blocker-topbar" },
      h("button", { className: "blocker-back", type: "button", onClick: () => onAction("blocker subview back"), "aria-label": "Back" }, h(Icon, { name: "chevron-left" })),
      h("strong", null, "Website Blocker"),
      h("span", { className: "blocker-topbar-spacer" })
    ),
    h("div", { className: "dns-hero" },
      h("span", { className: "dns-hero-icon" }, h(Icon, { name: "shield" }), h("span", { className: "dns-hero-check" }, h(Icon, { name: "check" }))),
      h("h1", null, "DNS Content Protection"),
      h("p", null, "The old blocker had gaps. You let us know. The new one closes them, system-wide, every browser, every app.")
    ),
    h("section", { className: "dns-steps" }, setupSteps.map((step, index) =>
      h("div", { key: step.num, className: "dns-step" },
        h("div", { className: "dns-step-number-col" },
          h("span", { className: "dns-step-number" }, step.num),
          index < setupSteps.length - 1 ? h("span", { className: "dns-step-line" }) : null
        ),
        h("div", { className: "dns-step-content" },
          h("strong", { className: "dns-step-title" }, step.title),
          h("button", { className: "dns-step-row", type: "button", onClick: () => showToast(`Step ${step.num}: ${step.rowText}`) },
            h("span", { className: `dns-step-row-icon ${step.num === 1 ? "gray" : step.num === 2 ? "blue" : "green"}` }, h(Icon, { name: step.rowIcon })),
            h("span", { className: "dns-step-row-text" }, step.rowText),
            h("span", { className: "dns-step-row-chevron" }, h(Icon, { name: "chevron" }))
          )
        )
      )
    )),
    h("button", { className: "dns-done-btn", type: "button", disabled: isCompleting, onClick: handleDone },
      h(Icon, { name: "check" }),
      h("span", null, "Done")
    )
  );
}

function BlockerTier2View({ blockerState, setBlockerState, onAction, showToast }) {
  const [blockedApps, setBlockedApps] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const tier2 = blockerState && blockerState.tier2 ? blockerState.tier2 : { enabled: false };
  const tier3On = blockerState && blockerState.tier3 ? blockerState.tier3.enabled : false;

  useEffect(() => {
    loadBlockerApps().then((data) => { setBlockedApps(data); setIsLoading(false); }).catch(() => { setIsLoading(false); showToast("Apps unavailable"); });
  }, []);

  async function handleToggle() {
    setIsToggling(true);
    try {
      const next = await toggleBlockerTier2(!tier2.enabled);
      setBlockerState(next);
      showToast(next.tier2.enabled ? "App Blocker enabled" : "App Blocker disabled");
    } catch (err) {
      showToast(err.message || "Toggle failed");
    } finally {
      setIsToggling(false);
    }
  }

  async function handleAddApp(appId) {
    try {
      const data = await addBlockerApp(appId);
      setBlockedApps(data.apps || []);
      setBlockerState(data.blocker || blockerState);
      showToast("App blocked");
    } catch (err) {
      showToast(err.message || "Add failed");
    }
  }

  async function handleRemoveApp(appId) {
    try {
      const data = await removeBlockerApp(appId);
      setBlockedApps(data.apps || []);
      setBlockerState(data.blocker || blockerState);
      showToast("App unblocked");
    } catch (err) {
      showToast(err.message || "Remove failed");
    }
  }

  const blockedIds = new Set(blockedApps.map((app) => app.id));
  const availableApps = blockerAvailableApps.filter((app) => !blockedIds.has(app.id));

  return h(
    "section",
    { className: "blocker-page blocker-subview" },
    h("header", { className: "blocker-topbar" },
      h("button", { className: "blocker-back", type: "button", onClick: () => onAction("blocker subview back"), "aria-label": "Back" }, h(Icon, { name: "chevron-left" })),
      h("strong", null, "App Blocker"),
      h("span", { className: "blocker-topbar-spacer" })
    ),
    h("section", { className: "blocker-tier-header" },
      h("span", { className: "blocker-tier-badge" }, "TIER 2"),
      h("h1", null, "App Blocker"),
      h("p", null, "Block any apps you want to avoid — distracting apps, browsers, anything. Uses Apple Screen Time."),
      h("div", { className: "blocker-toggle-row" },
        h("span", null, tier2.enabled ? "Active" : "Inactive"),
        h("button", {
          className: tier2.enabled ? "blocker-switch is-on" : "blocker-switch",
          type: "button",
          disabled: isToggling,
          onClick: handleToggle,
          "aria-label": "Toggle app blocker"
        }, h("span", { className: "blocker-switch-knob" }))
      )
    ),
    isLoading ? h("div", { className: "blocker-loading" }, "Loading...") : h(React.Fragment, null,
      blockedApps.length > 0 ? h(React.Fragment, null,
        h("h3", { className: "blocker-list-title" }, `Blocked Apps (${blockedApps.length})`),
        h("ul", { className: "blocker-app-list" }, blockedApps.map((app) =>
          h("li", { key: app.id, className: "blocker-app-item is-blocked" },
            h("span", { className: "blocker-app-avatar" }, app.name.charAt(0)),
            h("span", { className: "blocker-app-info" },
              h("strong", null, app.name),
              h("small", null, app.category)
            ),
            h("button", { className: "blocker-remove-btn", type: "button", disabled: tier3On, onClick: () => handleRemoveApp(app.id), "aria-label": `Unblock ${app.name}` }, h(Icon, { name: tier3On ? "lock" : "trash" }))
          )
        ))
      ) : h("p", { className: "blocker-empty-text" }, "No apps blocked yet. Select apps below to start blocking."),
      h("h3", { className: "blocker-list-title" }, "Available Apps"),
      h("ul", { className: "blocker-app-list" }, availableApps.map((app) =>
        h("li", { key: app.id, className: "blocker-app-item" },
          h("span", { className: "blocker-app-avatar" }, app.name.charAt(0)),
          h("span", { className: "blocker-app-info" },
            h("strong", null, app.name),
            h("small", null, app.category)
          ),
          h("button", { className: "blocker-add-app-btn", type: "button", onClick: () => handleAddApp(app.id), "aria-label": `Block ${app.name}` }, h(Icon, { name: "plus-circle" }))
        )
      ))
    )
  );
}

function BlockerTier3View({ blockerState, setBlockerState, onAction, showToast }) {
  const [passcode, setPasscode] = useState("");
  const [confirmPasscode, setConfirmPasscode] = useState("");
  const [unlockPasscode, setUnlockPasscode] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPasscode, setShowPasscode] = useState(false);
  const tier3 = blockerState && blockerState.tier3 ? blockerState.tier3 : { enabled: false };
  const tier2 = blockerState && blockerState.tier2 ? blockerState.tier2 : { apps: [] };
  const appCount = (tier2.apps || []).length;

  async function handleEnable() {
    if (passcode.length < 4) { showToast("Passcode must be at least 4 digits"); return; }
    if (passcode !== confirmPasscode) { showToast("Passcodes do not match"); return; }
    setIsProcessing(true);
    try {
      const next = await enableBlockerTier3(passcode);
      setBlockerState(next);
      setPasscode("");
      setConfirmPasscode("");
      showToast("Permanent lock enabled");
    } catch (err) {
      showToast(err.message || "Lock failed");
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleUnlock() {
    setIsProcessing(true);
    try {
      const next = await unlockBlockerTier3(unlockPasscode);
      setBlockerState(next);
      setUnlockPasscode("");
      showToast("Permanent lock removed");
    } catch (err) {
      showToast(err.message || "Unlock failed");
    } finally {
      setIsProcessing(false);
    }
  }

  return h(
    "section",
    { className: "blocker-page blocker-subview" },
    h("header", { className: "blocker-topbar" },
      h("button", { className: "blocker-back", type: "button", onClick: () => onAction("blocker subview back"), "aria-label": "Back" }, h(Icon, { name: "chevron-left" })),
      h("strong", null, "Permanent App Blocker"),
      h("span", { className: "blocker-topbar-spacer" })
    ),
    h("section", { className: "blocker-tier-header" },
      h("span", { className: "blocker-tier-badge danger" }, "TIER 3"),
      h("h1", null, "Permanent App Blocker"),
      h("p", null, "Lock your blocked apps in. Can't be undone — that's the point. You'll need a passcode if you ever want to remove the lock.")
    ),
    tier3.enabled ? h("section", { className: "blocker-tier3-locked" },
      h("div", { className: "blocker-tier3-lock-icon" }, h(Icon, { name: "lock" })),
      h("h2", null, "Apps are permanently locked"),
      h("p", null, `${appCount} app${appCount === 1 ? "" : "s"} locked since ${tier3.lockedAt ? new Date(tier3.lockedAt).toLocaleDateString() : "now"}. To remove the lock, enter your passcode below.`),
      h("div", { className: "blocker-passcode-field" },
        h("input", {
          className: "blocker-input",
          type: showPasscode ? "text" : "password",
          value: unlockPasscode,
          onChange: (event) => setUnlockPasscode(event.target.value),
          placeholder: "Enter passcode",
          onKeyDown: (event) => { if (event.key === "Enter" && unlockPasscode.length >= 4) handleUnlock(); }
        }),
        h("button", { className: "blocker-eye-btn", type: "button", onClick: () => setShowPasscode(!showPasscode), "aria-label": "Toggle passcode visibility" }, h(Icon, { name: showPasscode ? "eye-off" : "eye" }))
      ),
      h("button", { className: "blocker-danger-btn", type: "button", disabled: isProcessing || unlockPasscode.length < 4, onClick: handleUnlock }, "Remove Lock")
    ) : appCount === 0 ? h("section", { className: "blocker-tier3-warning" },
      h("span", { className: "blocker-tier3-warning-icon" }, h(Icon, { name: "warning" })),
      h("p", null, "You need to block at least one app in Tier 2 before you can enable the permanent lock."),
      h("button", { className: "blocker-link-btn", type: "button", onClick: () => onAction("blocker tier2") }, "Go to App Blocker")
    ) : h("section", { className: "blocker-tier3-setup" },
      h("div", { className: "blocker-tier3-apps-summary" },
        h("span", { className: "blocker-tier3-shield" }, h(Icon, { name: "shield" })),
        h("p", null, `${appCount} app${appCount === 1 ? "" : "s"} will be permanently locked.`)
      ),
      h("div", { className: "blocker-passcode-field" },
        h("input", {
          className: "blocker-input",
          type: showPasscode ? "text" : "password",
          value: passcode,
          onChange: (event) => setPasscode(event.target.value),
          placeholder: "Create passcode (4+ digits)"
        }),
        h("button", { className: "blocker-eye-btn", type: "button", onClick: () => setShowPasscode(!showPasscode), "aria-label": "Toggle passcode visibility" }, h(Icon, { name: showPasscode ? "eye-off" : "eye" }))
      ),
      h("div", { className: "blocker-passcode-field" },
        h("input", {
          className: "blocker-input",
          type: showPasscode ? "text" : "password",
          value: confirmPasscode,
          onChange: (event) => setConfirmPasscode(event.target.value),
          placeholder: "Confirm passcode"
        })
      ),
      h("div", { className: "blocker-tier3-caution" },
        h(Icon, { name: "warning" }),
        h("p", null, "This action cannot be undone without your passcode. Make sure you remember it.")
      ),
      h("button", { className: "blocker-danger-btn", type: "button", disabled: isProcessing || passcode.length < 4 || passcode !== confirmPasscode, onClick: handleEnable }, "Enable Permanent Lock")
    )
  );
}

function CommunityPage({ posts, filter, onAction }) {
  const [filterOpen, setFilterOpen] = useState(false);
  return h("div", { className: "community-page" },
    h("header", { className: "community-header" },
      h("div", { className: "community-header-left" },
        h("button", { className: "community-filter-btn", type: "button", onClick: () => setFilterOpen(!filterOpen) },
          h("span", null, "Filter: ", filter === "top" ? "Top" : "New"),
          h(Icon, { name: "chevron-down" })
        ),
        filterOpen ? h("div", { className: "community-filter-dropdown" },
          h("button", { className: filter === "new" ? "is-active" : "", type: "button", onClick: () => { onAction("community filter new"); setFilterOpen(false); } }, "New"),
          h("button", { className: filter === "top" ? "is-active" : "", type: "button", onClick: () => { onAction("community filter top"); setFilterOpen(false); } }, "Top")
        ) : null
      ),
      h("div", { className: "community-header-right" },
        h("button", { className: "community-icon-btn", type: "button", "aria-label": "Notifications" }, h(Icon, { name: "bell" })),
        h("button", { className: "community-icon-btn", type: "button", "aria-label": "Search" }, h(Icon, { name: "search" }))
      )
    ),
    h("h1", { className: "community-title" }, "Community"),
    h("div", { className: "community-post-list" },
      posts.length === 0
        ? h("div", { className: "community-empty" }, h("p", null, "No posts yet. Be the first to share."))
        : posts.map((post) =>
          h(CommunityPostCard, { key: post.id, post, onAction })
        )
    ),
    h("button", { className: "community-fab", type: "button", "aria-label": "New post", onClick: () => onAction("community new post") }, h(Icon, { name: "plus" }))
  );
}

function CommunityPostCard({ post, onAction }) {
  const [expanded, setExpanded] = useState(false);
  const [liked, setLiked] = useState(!!post.likedByMe);
  const [likeCount, setLikeCount] = useState(post.likes || 0);
  useEffect(() => {
    setLiked(!!post.likedByMe);
    setLikeCount(post.likes || 0);
  }, [post.id, post.likedByMe, post.likes]);
  const isLong = post.body && post.body.length > 120;
  const displayBody = expanded || !isLong ? post.body : post.body.slice(0, 120) + "...";
  return h("article", { className: "community-post-card", onClick: () => onAction(`community open ${post.id}`) },
    h("div", { className: "community-post-avatar" },
      h("span", { className: "community-avatar-emoji" }, post.authorAvatar),
      post.streak > 0 ? h("span", { className: "community-streak-badge" }, `${post.streak}d`) : null
    ),
    h("div", { className: "community-post-body" },
      h("div", { className: "community-post-meta" }, h("span", { className: "community-post-author" }, post.author), h("span", { className: "community-post-time" }, post.timeAgo || "")),
      h("h3", { className: "community-post-title" }, post.title),
      h("p", { className: "community-post-text" }, displayBody, isLong && !expanded ? h("button", { className: "community-see-more", type: "button", onClick: (e) => { e.stopPropagation(); setExpanded(true); } }, "See more") : null),
      h("div", { className: "community-post-stats" },
        h("span", { className: "community-stat" }, h(Icon, { name: "comment" }), String(post.commentCount || 0)),
        h("button", { className: "community-stat community-like-btn" + (liked ? " is-liked" : ""), type: "button", onClick: (e) => { e.stopPropagation(); const next = !liked; setLiked(next); setLikeCount(Math.max(0, likeCount + (next ? 1 : -1))); toggleCommunityLike(post.id).catch(() => { setLiked(!next); setLikeCount(likeCount); }); } }, h(Icon, { name: "heart" }), String(likeCount)),
        h("span", { className: "community-stat" }, h(Icon, { name: "eye" }), String(post.views || 0))
      )
    )
  );
}

function PostDetailPage({ post, onAction, showToast, setPost }) {
  const [commentText, setCommentText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [liked, setLiked] = useState(post ? !!post.likedByMe : false);
  const [likeCount, setLikeCount] = useState(post ? (post.likes || 0) : 0);
  useEffect(() => {
    if (post) {
      setLiked(!!post.likedByMe);
      setLikeCount(post.likes || 0);
    }
  }, [post && post.id, post && post.likedByMe, post && post.likes]);
  if (!post) {
    return h("div", { className: "community-page community-loading" },
      h("div", { className: "community-topbar" },
        h("button", { className: "community-back-btn", type: "button", onClick: () => onAction("community post back") }, h(Icon, { name: "chevron-left" })),
        h("h1", null, "Post")
      ),
      h("div", { className: "community-loading-text" }, "Loading...")
    );
  }
  async function handleComment() {
    const text = commentText.trim();
    if (!text || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const data = await addCommunityComment(post.id, text);
      setPost(data.post);
      setCommentText("");
      showToast("Comment posted");
    } catch (err) {
      showToast(err.message || "Comment failed");
    } finally {
      setIsSubmitting(false);
    }
  }
  return h("div", { className: "community-page community-detail-page" },
    h("header", { className: "community-topbar" },
      h("button", { className: "community-back-btn", type: "button", onClick: () => onAction("community post back") }, h(Icon, { name: "chevron-left" })),
      h("h1", null, "Post"),
      h("button", { className: "community-icon-btn", type: "button", "aria-label": "More" }, h(Icon, { name: "more" }))
    ),
    h("article", { className: "community-detail-post" },
      h("div", { className: "community-detail-header" },
        h("span", { className: "community-avatar-emoji community-avatar-lg" }, post.authorAvatar),
        h("div", null,
          h("div", { className: "community-post-author" }, post.author),
          h("div", { className: "community-post-streak" }, post.streak > 0 ? `${post.streak} Day Streak` : "New member")
        )
      ),
      h("h2", { className: "community-post-title" }, post.title),
      h("p", { className: "community-post-text" }, post.body),
      h("div", { className: "community-post-stats-bar" },
        h("span", { className: "community-stat" }, h(Icon, { name: "comment" }), String(post.commentCount || 0)),
        h("button", { className: "community-stat community-like-btn" + (liked ? " is-liked" : ""), type: "button", onClick: () => { const next = !liked; setLiked(next); setLikeCount(Math.max(0, likeCount + (next ? 1 : -1))); toggleCommunityLike(post.id).catch(() => { setLiked(!next); setLikeCount(likeCount); }); } }, h(Icon, { name: "heart" }), String(likeCount)),
        h("span", { className: "community-stat" }, h(Icon, { name: "eye" }), `${post.views || 0} views`)
      )
    ),
    h("div", { className: "community-comments-section" },
      h("h3", { className: "community-comments-title" }, post.comments && post.comments.length > 0 ? `${post.comments.length} Comment${post.comments.length === 1 ? "" : "s"}` : "Comments"),
      post.comments && post.comments.length > 0
        ? h("div", { className: "community-comment-list" }, post.comments.map((comment) =>
          h("div", { key: comment.id, className: "community-comment" },
            h("span", { className: "community-avatar-emoji community-avatar-sm" }, comment.authorAvatar),
            h("div", { className: "community-comment-body" },
              h("div", { className: "community-comment-meta" }, h("span", { className: "community-comment-author" }, comment.author), h("span", { className: "community-comment-time" }, comment.timeAgo || formatTimeAgoLocal(comment.createdAt))),
              h("p", { className: "community-comment-text" }, comment.text)
            )
          )
        ))
        : h("div", { className: "community-no-comments" }, "No comments yet. Be the first to comment.")
    ),
    h("div", { className: "community-comment-input-bar" },
      h("input", {
        className: "community-comment-input",
        type: "text",
        value: commentText,
        onChange: (event) => setCommentText(event.target.value),
        placeholder: "Say something",
        onKeyDown: (event) => { if (event.key === "Enter" && commentText.trim()) handleComment(); }
      }),
      h("button", { className: "community-send-btn", type: "button", disabled: isSubmitting || !commentText.trim(), onClick: handleComment }, h(Icon, { name: "send" }))
    )
  );
}

function CreatePostPage({ onAction, showToast }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  async function handleSubmit() {
    if ((!title.trim() && !body.trim()) || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const data = await createCommunityPost(title.trim(), body.trim());
      showToast("Post published");
      onAction("create post back");
    } catch (err) {
      showToast(err.message || "Post failed");
    } finally {
      setIsSubmitting(false);
    }
  }
  return h("div", { className: "community-page community-create-page" },
    h("header", { className: "community-topbar" },
      h("button", { className: "community-back-btn", type: "button", onClick: () => onAction("create post back") }, h(Icon, { name: "chevron-left" })),
      h("h1", null, "New Post"),
      h("button", { className: "community-publish-btn", type: "button", disabled: isSubmitting || (!title.trim() && !body.trim()), onClick: handleSubmit }, "Post")
    ),
    h("div", { className: "community-create-form" },
      h("input", {
        className: "community-create-title",
        type: "text",
        value: title,
        onChange: (event) => setTitle(event.target.value),
        placeholder: "Title",
        maxLength: 100
      }),
      h("textarea", {
        className: "community-create-body",
        value: body,
        onChange: (event) => setBody(event.target.value),
        placeholder: "Share your thoughts...",
        rows: 10
      })
    )
  );
}

function formatTimeAgoLocal(date) {
  if (!date) return "";
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  const weeks = Math.floor(diff / 604800000);
  if (weeks >= 1) return `${weeks}w ago`;
  if (days >= 1) return `${days}d ago`;
  if (hours >= 1) return `${hours}h ago`;
  if (minutes >= 1) return `${minutes}m ago`;
  return "just now";
}

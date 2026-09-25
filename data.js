/* =====================================================================
   THE COACH'S PLAYBOOK · DATA FILE
   ---------------------------------------------------------------------
   This is the only file you need to edit to update the flipbook.

   COACHES: replace the placeholder names, bios and photos below.
     - photo: put a square photo in images/coaches/ and write its path,
       e.g. "images/coaches/marcus.jpg". Leave "" to show initials.
     - id: keep it short, lowercase, no spaces. Boards point to this id.

   BOARDS: each board belongs to one coach via  coach: "<coach id>".
     - quip = the one-liner in the coach's voice (shown big)
     - note = the plain summary of the session (shown small)
     - category must be one of: "Cardio", "Strength", "HIIT", "Hybrid"
     - date is YYYY-MM-DD
     - image  = cleaned board (page view), full = cleaned board (zoom),
       original = the untouched photo (lightbox toggle)
     - transcript is read by screen readers and search engines.
   Boards show in the book in the order they appear in this list.
   ===================================================================== */

window.PLAYBOOK = {
  studio: {
    name: "BFT Beauty World",
    offerUrl: "https://www.bft-bw.com/8classesfor60-optin",
    offerLine: "8 classes for $60",
    offerShort: "8 for $60",
    offerSmall: "Usually $240. New members only. Use them within 3 weeks. No contract.",
    address: "144 Upper Bukit Timah Rd, #03-06B, Singapore 588177"
  },

  coaches: [
    {
      id: "coach-a",
      name: "Jay",
      role: "Coach",
      specialty: "Placeholder: e.g. strength and tempo work",
      yearsCoaching: 0,
      oneLiner: "",
      bio: "Placeholder bio for Jay. Two or three sentences: how long he's coached, what he loves programming, one fun fact members wouldn't guess.",
      favouriteSession: "",
      signatureDoodle: "",
      instagram: "",
      photo: "images/coaches/jay.jpg"
    },
    {
      id: "coach-b",
      name: "Coach B",
      role: "Coach",
      specialty: "Conditioning and pacing",
      yearsCoaching: 0,
      oneLiner: "Placeholder: one line in the coach's own voice.",
      bio: "Placeholder bio. Two or three sentences: how long they've coached, what they love programming, one fun fact members wouldn't guess.",
      favouriteSession: "Placeholder",
      signatureDoodle: "Placeholder",
      instagram: "",
      photo: ""
    },
    {
      id: "coach-c",
      name: "Coach C",
      role: "Coach",
      specialty: "Heart-rate zone training",
      yearsCoaching: 0,
      oneLiner: "Placeholder: one line in the coach's own voice.",
      bio: "Placeholder bio. Two or three sentences: how long they've coached, what they love programming, one fun fact members wouldn't guess.",
      favouriteSession: "Placeholder",
      signatureDoodle: "Placeholder",
      instagram: "",
      photo: ""
    },
    {
      id: "coach-d",
      name: "Coach D",
      role: "Coach",
      specialty: "HIIT and hybrid sessions",
      yearsCoaching: 0,
      oneLiner: "Placeholder: one line in the coach's own voice.",
      bio: "Placeholder bio. Two or three sentences: how long they've coached, what they love programming, one fun fact members wouldn't guess.",
      favouriteSession: "Placeholder",
      signatureDoodle: "Placeholder",
      instagram: "",
      photo: ""
    }
  ],

  boards: [
    {
      id: "strength-4-sets",
      program: "Strength",
      progression: "",
      category: "Strength",
      date: "2026-02-19",
      coach: "coach-a",
      note: "Four exercises, four sets. Warm up, slow it down on a 0-2-0 tempo, then load up for 8 to 10 reps.",
      quip: "0-2-0 means two full seconds on the way down. Yes, I'm counting.",
      file: "IMG20260219183642.jpg",
      transcript: "Strength. 4 exercises, 4 sets. 1: Warm ups, mobility drills, 2 mins each screen. 2: Tempo work, 0-2-0. 3: 8-10RM load. KB walk, BB back squat, deadlift, lunges."
    },
    {
      id: "balance-final",
      program: "Balance",
      progression: "Final",
      category: "Strength",
      date: "2026-02-20",
      coach: "coach-b",
      note: "Screens 1 and 3 get 45 seconds of work. Screen 2 is slow and controlled, technique first.",
      quip: "Screen 2 is slow on purpose. The wobble is the workout.",
      file: "IMG20260220183806.jpg",
      transcript: "Final! Ba-lance. Screen 1 and 3: 4 exercises, 45 secs of work, 20s rest, x3. Screen 2: 2 exercises, slow and controlled, technique first. 5 reps, you go I go, 6 mins."
    },
    {
      id: "hiit-1-of-8",
      program: "HIIT",
      progression: "1/8",
      category: "HIIT",
      date: "2026-03-11",
      coach: "coach-d",
      note: "Near max effort, always. Five sets of 15 seconds on, 10 off.",
      quip: "Fifteen seconds is short. Make it feel long.",
      file: "IMG20260311173705.jpg",
      transcript: "HIIT, high intensity interval training, progression 1/8. Focus: near max effort always. 5 sets, 15s on / 10s off. Use rest between exercises to reset and recover. 1: Machines (ski erg, row, bikes): accelerate fast, maintain and hold. 2: Explosives (box jumps, battle ropes): vertical force output, trunk control. 3: Mixed conditioning (burpees, powerbag thrusters): watch posture when tired, control breathing."
    },
    {
      id: "cardio-summit-april",
      program: "Cardio Summit",
      progression: "",
      category: "Cardio",
      date: "2026-04-03",
      coach: "coach-c",
      note: "Six zones. Finish your targets, swap with your partner, keep alternating for six minutes. Consistency, not kill your partner!",
      quip: "Your partner rests while you work. Try not to take it personally.",
      file: "IMG20260403100613.jpg",
      transcript: "Cardio Summit, 3 April. Training intention: build cardio endurance. 6 zones: main exercise (odd numbers) and accessory (even numbers). Focus on high sustainable aerobic output, about 85-89%. Finish your targets, then swap with partner and keep alternating for 6 mins. Consistency, not kill your partner!"
    },
    {
      id: "cardio-summit-5-of-8",
      program: "Cardio Summit",
      progression: "5/8",
      category: "Cardio",
      date: "2026-04-22",
      coach: "coach-c",
      note: "Three sets of 60 seconds per exercise. Climb the mountain at 85 to 89% heart rate, rest at the peak.",
      quip: "There's a mountain on the board. You're climbing it three times.",
      file: "IMG20260422180429.jpg",
      transcript: "Cardio Summit, progression 5/8. Steady effort heart rate climbing to 85-89%, rest, times 3. Per exercise: 3 sets of 60 secs. Improve aerobic power and anaerobic tolerance."
    },
    {
      id: "shred-final",
      program: "Shred",
      progression: "Final",
      category: "Hybrid",
      date: "2026-05-09",
      coach: "coach-d",
      note: "Pick your order: cardio first or strength first. Work under fatigue and keep every rep clean.",
      quip: "Cardio first or strength first? Either way, you're sweating by zone two.",
      file: "IMG20260509103441.jpg",
      transcript: "Shred, final progression. Cardio, strength 1, cardio, strength 2, or strength 1, cardio, strength 2, cardio. Cardio: 1 set x 45s, summit style. Strength: 3 sets x 40s on / 35s off. Work under fatigue, improve quality movements. Cardio first? Improve cardiovascular endurance. Good luck. Strength first? Build strength baby! Have fun."
    },
    {
      id: "strength-endurance-2",
      program: "Strength Endurance",
      progression: "2nd",
      category: "Hybrid",
      date: "2026-06-08",
      coach: "coach-a",
      note: "Six zones, two exercises each. Superset 35 seconds per exercise, six sets per zone.",
      quip: "Thirty-five seconds, six sets, six zones. Bring a towel. Bring two.",
      file: "IMG20260608183814.jpg",
      transcript: "Strength Endurance, 2nd progression. Focus: building and improving overall endurance, strength and cardio. 6 zones, 2 exercises per zone. Superset, 35 secs per exercise, rest 30 secs, 6 sets per zone. DB RDL: hinge, neutral spine, tension in hamstrings. KB shoulder press: stable trunk, brace, reset after each rep. Deadball squat: avoid knees collapsing and excessive fwd lean. Dips/pushups: shoulder positioning, range of motion."
    },
    {
      id: "summit-4th",
      program: "Summit",
      progression: "4th",
      category: "Cardio",
      date: "2026-06-25",
      coach: "coach-b",
      note: "Controlled intensity, steady state. Keep it in the purple zone, 80 to 89% heart rate. I have the power!",
      quip: "Stay in the purple. I can see your heart rate on the screen.",
      file: "IMG20260625091223.jpg",
      transcript: "Summit, 4th progression. Set 1, set 2, set 3, maintain purple heart rate 80-89%. Target your aerobic capacity, improve your cardiovascular endurance. Controlled intensity and maintain steady state workout. Focus on movement efficiency and breathing techniques. I have the power!"
    },
    {
      id: "summit-3-of-6",
      program: "Summit",
      progression: "3/6",
      category: "Cardio",
      date: "2026-08-13",
      coach: "coach-c",
      note: "Work time climbs from 35 to 60 seconds. Build momentum, pace your breathing, swap in a zone.",
      quip: "Every round gets longer. Your breathing shouldn't get louder.",
      file: "IMG20260813083249.jpg",
      transcript: "Summit, progression 3/6. Strategy: build momentum, pace your breathing, sustain your effort under fatigue. Format: ascending work time, 80-89% HR zone. 35, 45, 55, 60 sec, 50 sec rest, 8 sets total. 1 zone = 2 exercises, total 6 zones = 12 exercises, swap in a zone. Hip switches: tabletop position, shoulders and knees close, pivot feet, hips low. Alternate: mountain climber. Rower: push feet away first, lean back slightly, handle to sternum, 30-35 strokes per minute, watch the force curve."
    },
    {
      id: "pause-reps",
      program: "Pause Reps",
      progression: "",
      category: "Strength",
      date: "2026-08-17",
      coach: "coach-a",
      note: "Pause at mid-shin on the deadlift and at the bottom of the squat. No chicken legs today.",
      quip: "Ken the Hen has better legs than most of you. Let's fix that.",
      file: "IMG20260817095546.jpg",
      transcript: "Program: 2 mins 30 secs, 5 reps per set. Pause reps: challenge your stability and control, more time under tension, no momentum. BB deadlift: pause at mid-shin, 65-75% of 5RM, maintain tension before pushing feet away from floor. KB front squat: pause at bottom of squat, maintain upright torso, push feet away from floor. Ken the (Jacked) Hen: no chicken legs today, let's build strong legs baby!"
    },
    {
      id: "cardio-u",
      program: "Cardio U",
      progression: "",
      category: "Cardio",
      date: "2026-09-04",
      coach: "coach-b",
      note: "Six sets of 30 seconds, non-stop. If Pika can do it, so can you.",
      quip: "Six sets, no stopping. Pikachu did it with tiny legs.",
      file: "IMG20260904131209.jpg",
      transcript: "Cardio U. Intensity chart across 6 sets. 6 sets, 30s per set, non-stop. Controlled movements under fatigue. Improve aerobic endurance and recovery speed. Build stamina and pace control. If Pika can do it, so can you! Please wipe down the equipment once done too."
    },
    {
      id: "cardio-ewww",
      program: "Cardio. Ewww...",
      progression: "",
      category: "Cardio",
      date: "2026-09-25",
      coach: "coach-d",
      note: "Three zones of four exercises, two laps each. Match your intensity to your heart rate and speed up as you go.",
      quip: "I know. I drew a cat so you'd forgive me.",
      file: "IMG20260925090237.jpg",
      transcript: "Cardio - ewww. Format: 3 zones of 4 exercises, 2 sets on each exercise, 2 laps in the zone. Complete all 3 zones. Objective: regulate intensity to match HR, heart rate control, pacing awareness, progressive acceleration. A-meow-tti."
    }
  ]
};

//sendGrid credentials
exports.credentials = {
    apiKey: process.env.SENDGRID_API_KEY
};

//recieve email from
exports.emailFrom = {
    from: 'no-reply@linkagoal.com',
    feedback: 'linkagoal@gmail.com'
};

exports.allTemplates = {
    CONTRIBUTION: {
        id: '0d425780-999f-4e66-afa8-919085db7368',
        desc: 'CONTRIBUTION'
    },
    GOAL_FOLLOWED: {
        id: 'ab6c255f-5524-46d9-8c48-8e8f1bab827b',
        desc: 'GOAL_FOLLOWED'
    },
    LINK_GOAL: {
        id: '41c8dec9-e53b-4b6b-b412-c0ff4b0ade49',
        desc: 'LINK_GOAL'
    },
    MILESTONE_COMPLETED: {
        id: '07109bfe-2109-4073-a69e-7e0d44a1ca41',
        desc: 'MILESTONE_COMPLETED'
    },
    MILESTONE_CREATED: {
        id: '62a5a1f1-fe58-4494-a954-71bb820eb9fa',
        desc: 'MILESTONE_CREATED'
    },
    MOTIVATE_ON_GOAL: {
        id: 'bcb0ca40-3033-477a-a973-80b7e2c09150',
        desc: 'MOTIVATE_ON_GOAL'
    },
    USER_FOLLOWED: {
        id: '053e7b76-3b3e-40f3-8866-6ccd40bbcbbe',
        desc: 'USER_FOLLOWED'
    },
    PROGRESS_UPDATED: {
        id: 'b0c0a078-9452-44c4-9241-c7e0511d81b4',
        desc: 'PROGRESS_UPDATED'
    },
    WELCOME: {
        id: '3faab361-1767-4226-abf4-a5ee095f06a8',
        desc: 'WELCOME'
    },
    VERIFICATION_EMAIL: {
        id: '5d28e508-1127-444e-81af-6745d0ec3ba8',
        desc: 'VERIFICATION_EMAIL'
    },
    RESET_PASSWORD: {
        id: '38fbf7e6-37c3-4f50-be9b-0559f450cdc2',
        desc: 'RESET_PASSWORD'
    },
    PASSWORD_CHANGE_EMAIL: {
        id: '4aec2630-88d3-467c-ae4c-f1e5331fd8b8',
        desc: 'PASSWORD_CHANGE_EMAIL'
    },
    INVITE: {
        id: '3b2ad916-be98-4eae-a0af-e47f28befd76',
        desc: 'INVITE'
    },
    Thankyou_For_Your_Feedback: {
        id: 'a369f8de-e8d5-456b-afcb-10879f4dab31',
        desc: 'Thankyou_For_Your_Feedback'
    },
    FEEDBACK_RECEIVED: {
        id: '3319d9b8-a0c6-456a-82f8-f3c5c6bfdc12',
        desc: 'FEEDBACK_RECEIVED'
    },
    DEACTIVATION_EMAIL: {
        id: 'e1672c65-ddcc-4040-b99a-d9ce2d11edd7',
        name: 'DEACTIVATION_EMAIL'
    },
    Progress_Update_On_Followed_Goal_New: {
        id: '01e19050-b380-4a08-8d65-1d723d1122d1',
        name: 'Progress_Update_On_Followed_Goal_New'
    },
    PROFILE_OF_THE_WEEK: {
        id: 'fa8160b8-1025-413c-86d8-6d844846fc26',
        name: 'PROFILE_OF_THE_WEEK'
    },
    POPULAR_GOAL_OF_THE_WEEK: {
        id: '1e6d57d8-530e-447f-b9a0-d72d852157bc',
        name: 'PROFILE_OF_THE_WEEK'
    },
    HOT_NEW_GOAL_OF_THE_WEEK: {
        id: 'a67cf146-a36c-4a3e-92f5-858fb1cf03dc',
        name: 'HOT_NEW_GOAL_OF_THE_WEEK'
    },
    PROFILE_FEATURED_SELF: {
        id: '4bd86b9e-51ac-498c-8922-208969cdf91a',
        name: 'PROFILE_FEATURED_SELF'
    },
    DRIP_CAMPAIGN_6_CONNECT_LIFE_EVENTS: {
        id: 'f18fadd1-51bb-4c96-a5cd-07db9d44ffa7',
        name: 'DRIP_CAMPAIGN_6_CONNECT_LIFE_EVENTS'
    },
    DRIP_CAMPAIGN_5_CONNECT_LIFE_EVENTS: {
        id: '91e5b588-b4ff-47e3-b469-b7bf69aff7cc',
        name: 'DRIP_CAMPAIGN_5_CONNECT_LIFE_EVENTS'
    },
    DRIP_CAMPAIGN_4_CONNECT_LIFE_EVENTS: {
        id: '3f9900f9-e349-4afb-be78-56898afff840',
        name: 'DRIP_CAMPAIGN_4_CONNECT_LIFE_EVENTS'
    },
    DRIP_CAMPAIGN_3_CONNECT_LIFE_EVENTS: {
        id: '665a4cfb-2b52-44a2-8c58-a0f50629a4df',
        name: 'DRIP_CAMPAIGN_3_CONNECT_LIFE_EVENTS'
    },
    DRIP_CAMPAIGN_2_CONNECT_LIFE_EVENTS: {
        id: '4b619c72-bcfd-4d57-8319-3fd681e5afda',
        name: 'DRIP_CAMPAIGN_2_CONNECT_LIFE_EVENTS'
    },
    DRIP_CAMPAIGN_1_CONNECT_LIFE_EVENTS: {
        id: '9291b6c3-07e9-47a8-8ec2-b136d14732fa',
        name: 'DRIP_CAMPAIGN_1_CONNECT_LIFE_EVENTS'
    },
    FRIEND_ON_LINKAGOAL: {
        id: '555751a7-5a5e-4611-b477-4b44a4f93740',
        name: 'FRIEND_ON_LINKAGOAL'
    },
    GREETINGS: {
        id: 'd33e557b-3d63-447a-b983-be06b472af6f',
        name: 'Greetings'
    },
    APP_UPDATE_EMAIL: {
        id: '09f820ff-594a-494f-b3c3-7b118a7d57e2',
        name: 'APP_UPDATE_EMAIL'
    },
    REACTIVATE_USERS: {
        id: 'cf2a2c02-7d59-4037-88a1-a77e25df8241',
        name: 'REACTIVATE_USERS'
    },
    PRE_LAUNCH_RETENTION: {
        id: '0cf5e6a3-b419-4fce-b2d3-0ba473c52ff4',
        name: 'PRE_LAUNCH_RETENTION'
    },
    UNSUBSCRIBE_EMAIL: {
        id: '1f901004-afd3-4bbb-bde0-8e1fb81f2e12',
        name: 'UNSUBSCRIBE_EMAIL'
    },
    HASHTAG_CAMPAIGN_UPDATES: {
        id: '28344694-07e3-4058-8873-a207d8c526d4',
        name: 'HASHTAG_CAMPAIGN_UPDATES'
    },
    ANNOUNCEMENT_EMAILS: {
        id: '1255d486-a66f-44ee-be92-affd8bf32ff1',
        name: 'ANNOUNCEMENT_EMAILS'
    },
    WEB_CHANGES_ANNOUNCEMENT: {
        id: '305de73f-e432-4202-8ee8-f6ffecc4bf9b',
        name: 'WEB_CHANGES_ANNOUNCEMENT'
    },
    WEEKLY_BUZZ: {
        id: '443fe4da-8423-4eae-a4f7-dcec80b798ec',
        name: 'WEEKLY_BUZZ'
    },
    NEW_HASHTAG_ANNOUNCEMENT: {
        id: '86e8f27b-fb98-48aa-b747-6e724908ce00',
        name: 'NEW_HASHTAG_ANNOUNCEMENT'
    }
};

//require and set all the tables

var allTables = {
    "default_category": require('./sequelize_old/default_category'),
    "tags": require('./sequelize_old/tags'),
    "category_tags": require('./sequelize_old/category_tags'),

    "sessions": require('./sequelize_old/sessions'),

    "users": require('./sequelize_old/users'),
    "user_block": require('./sequelize_old/user_block'),
    "userdeactivate": require('./sequelize_old/userdeactivate'),

    "user_followers": require('./sequelize_old/user_followers'),
    "OrganizationModel": require('./sequelize_old/OrganizationModel'),
    "user_work_history": require('./sequelize_old/user_work_history'),
    "user_education_history": require('./sequelize_old/user_education_history'),
    "user_skills": require('./sequelize_old/user_skills'),
    "contacts": require('./sequelize_old/contacts'),
    "user_interest_tags": require('./sequelize_old/user_interest_tags'),
    "featured_users": require('./sequelize_old/featured_users'),
    "location": require('./sequelize_old/location'),

    "privacy_scope": require('./sequelize_old/privacy_scope'),


    "goals": require('./sequelize_old/goals'),
    "goal_motivate": require('./sequelize_old/goal_motivate'),
    "goal_mute": require('./sequelize_old/goal_mute'),
    "goal_linked": require('./sequelize_old/goal_linked'),
    "goals_tags": require('./sequelize_old/goals_tags'),
    "goal_followers": require('./sequelize_old/goal_followers'),

    //explore
    "hot_new_goals": require('./sequelize_old/hot_new_goals'),
    "popular_goals": require('./sequelize_old/popular_goals'),

    //post
    "posts": require('./sequelize_old/posts'),
    "posts_tag": require('./sequelize_old/posts_tag'),
    "post_motivate": require('./sequelize_old/post_motivate'),

    //post comments
    "comments": require('./sequelize_old/comments'),

    //replies
    "post_replies": require('./sequelize_old/post_replies'),

    "user_email_verification": require('./sequelize_old/user_email_verification'),
    "user_password_verification": require('./sequelize_old/user_password_verification'),

    "milestone": require('./sequelize_old/milestone'),

    //feed
    "user_activity": require('./sequelize_old/user_activity'),
    "user_feed": require('./sequelize_old/user_feed'),

    //notifications
    "default_notification_types": require('./sequelize_old/default_notification_types'),
    "notifications": require('./sequelize_old/notifications'),
    "user_notification_settings": require('./sequelize_old/user_notification_settings'),
    "post_followers": require('./sequelize_old/post_followers'),
    "user_mute": require('./sequelize_old/user_mute'),
    "ResourceCenterModel": require('./sequelize_old/ResourceCenter'),
    "ResourceCenterTagsModel": require('./sequelize_old/ResourceCenterTags'),
    "email_templates" : require('./sequelize_old/email_templates'),

    //media
    "album": require('./sequelize_old/album'),
    "user_file_uploads": require('./sequelize_old/user_file_uploads'),
    "images_thumbs": require('./sequelize_old/images_thumbs'),

    //views
    "views_goal": require('./sequelize_old/views_goal'),
    "views_post": require('./sequelize_old/views_post'),
    "views_user_profile": require('./sequelize_old/views_user_profile'),
    "views_video": require('./sequelize_old/views_video'),
    "listen_audio": require('./sequelize_old/listen_audio'),


    "file_compressions": require('./sequelize_old/file_compressions'),
    "UsersCoachmarksModel": require('./sequelize_old/UsersCoachmarks'),
    "CoachmarksModel": require('./sequelize_old/Coachmarks'),
    "fetched_url_data": require('./sequelize_old/fetched_url_data'),
    "user_defined_location": require('./sequelize_old/user_defined_location'),
    "mentioned_comment": require('./sequelize_old/mentioned_comment'),
    "mentioned_post": require('./sequelize_old/mentioned_post'),
    "mentioned_reply_comment": require('./sequelize_old/mentioned_reply_comment'),


    "privacy_specific_goal": require('./sequelize_old/privacy_specific_goal'),
    "privacy_specific_post": require('./sequelize_old/privacy_specific_post'),
    "user_follow_request":  require('./sequelize_old/user_follow_request'),
    "feedbacks" : require('./sequelize_old/feedbacks'),
    "invitations" : require('./sequelize_old/invitations'),
    "invitations_accepted" : require('./sequelize_old/invitations_accepted'),
    "suggested_users_ignored" : require('./sequelize_old/suggested_users_ignored'),
    "user_stats" : require('./sequelize_old/user_stats')
};

exports.allTables = allTables;

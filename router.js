var responseTime = require('response-time');

//loading controllers
var session = require('./controllers/session');
var user = require('./controllers/user');
var categories = require('./controllers/categories');
var contributions = require('./controllers/contributions');
var comments = require('./controllers/comments');
var tags = require('./controllers/tags');
var goals = require('./controllers/goals');
var explore = require('./controllers/explore');
var dashboard = require('./controllers/dashboard');
var posts = require('./controllers/posts');
var progress = require('./controllers/progress');
var milestone = require('./controllers/milestone');
var feed = require('./controllers/feed');
var ResourceCenterCtrl = require('./controllers/ResourceCenter');
var CoachmarkCtrl = require('./controllers/Coachmarks');
var contacts = require('./controllers/contacts');
var contacts = require('./controllers/contacts');
var search = require('./controllers/search');
var replies = require('./controllers/replies');
var Education = require('./controllers/Education');
var Work = require('./controllers/Work');
var Skills = require('./controllers/Skills');
var notifications = require('./controllers/Notifications');
var notifications_push = require('./controllers/PushNotifications');
var lists = require('./controllers/lists');
var album = require('./controllers/album');
var profile = require('./controllers/profile');
var privacy = require('./controllers/Privacy');
var socialIntegration = require('./controllers/SocialIntegration');
var invite = require('./controllers/Invite');
var feedback = require('./controllers/Feedback');
var invite = require('./controllers/Invite');

var test = require('./controllers/Test');     //test


module.exports = function (apiRouter, fileRouter) {

    // **** define your routes inside this block **** //
    if (apiRouter != null) {
        apiRouter.use(responseTime()); // add response time in all headers

        //USER
        apiRouter.get({path: '/users/invitations', version: '1.0.0'}, user.getAllInvitations);
        apiRouter.post({path: '/login', version: '1.0.0'}, session.login);
        apiRouter.post({path: '/logout', version: '1.0.0'}, session.logout);
        apiRouter.post({path: '/register', version: '1.0.0'}, user.register);
        apiRouter.get({path: '/login/token', version: '1.0.0'}, session.verifyToken);
        apiRouter.get({path: '/users/:username', version: '1.0.0'}, user.getUserProfile);
        apiRouter.post({path: '/users/:username/profile', version: '1.0.0'}, user.update); //Object key issue
        apiRouter.get({path: '/users/:username', version: '1.0.0'}, user.hoverCard);
        apiRouter.del({path: '/users/:id', version: '1.0.0'}, user.delete);
        apiRouter.del({path: '/users/revert/:id', version: '1.0.0'}, user.revertDelete);
        apiRouter.get({path: '/user/:id/about', version: '1.0.0'}, user.about);

        //User Follows
        apiRouter.post({path: '/users/:userName/follow', version: '1.0.0'}, user.followUser);
        apiRouter.del({path: '/users/:userName/follow', version: '1.0.0'}, user.unfollowUser);
        apiRouter.get({path: '/users/invitations/seen', version: '1.0.0'}, user.viewRequest);
        apiRouter.post({path: '/users/request/:uid/accept', version: '1.0.0'}, user.requestActive);
        apiRouter.post({path: '/users/request/:uid/reject', version: '1.0.0'}, user.requestRejected);
        apiRouter.post({path: '/users/request/reject-multiple', version: '1.0.0'}, user.multipleRequestRejected);

        apiRouter.post({path: '/users/request/:uid/cancel', version: '1.0.0'}, user.requestCancel);
        apiRouter.post({path: '/users/request/cancel-multiple', version: '1.0.0'}, user.multipleRequestCancelled);
        apiRouter.post({path: '/users/friendship/follow-multiple', version: '1.0.0'}, user.multifollowUser);
        apiRouter.del({path: '/users/friendship/follow-multiple', version: '1.0.0'}, user.multiUnfollowUser);
        apiRouter.put({path: '/onboarding/done', version: '1.0.0'}, user.onBoarding);

        //Sessions
        apiRouter.get({path: '/account/sessions', version: '1.0.0'}, user.getSessions);
        apiRouter.del({path: '/account/sessions/:id', version: '1.0.0'}, user.killSessions);

        //Account Security     
        apiRouter.put({path: '/account/deactivate', version: '1.0.0'}, user.deactivateUserAccount);
        apiRouter.post({path: '/account/validate', version: '1.0.0'}, user.validateUsernameEmail);    //validate username and email duplication
        apiRouter.put({path: '/account/change', version: '1.0.0'}, user.changeUsernameEmail);      //update username and email
        apiRouter.put({path: '/account/changepassword', version: '1.0.0'}, user.changePassword);           //manual password change
        apiRouter.post({path: '/account/forgot', version: '1.0.0'}, user.forgetPassword);           //forgot password
        apiRouter.get({path: '/account/forgot/:verificationkey', version: '1.0.0'}, user.verifyForgetPassword);
        apiRouter.put({path: '/account/reset', version: '1.0.0'}, user.resetPassword);
        apiRouter.post({path: '/account/verify', version: '1.0.0'}, user.userVerification);         //email Verification
        apiRouter.get({path: '/account/verify/:verificationkey', version: '1.0.0'}, user.verifyHyperLink);
        apiRouter.post({path: '/invitations/generate', version: '1.0.0'}, invite.generate_invite_link);
        apiRouter.get({path: '/invitations/inviter', version: '1.0.0'}, invite.getInviter);

        //Account Settings
        apiRouter.get({path: '/users/block/list', version: '1.0.0'}, lists.getUserBlock);
        apiRouter.post({path: '/users/block/:username', version: '1.0.0'}, user.userBlock);
        apiRouter.del({path: '/users/block/:username', version: '1.0.0'}, user.userUnblock);

        apiRouter.post({path: '/goals/mute/:id', version: '1.0.0'}, goals.goalMute);
        apiRouter.get({path: '/goals/mute/list', version: '1.0.0'}, lists.getGoalMute);
        apiRouter.del({path: '/goals/mute/:id', version: '1.0.0'}, goals.goalUnMute);

        apiRouter.get({path: '/users/mute/list', version: '1.0.0'}, lists.getUserMute);
        apiRouter.post({path: '/users/mute/:username', version: '1.0.0'}, user.userMute);
        apiRouter.del({path: '/users/mute/:username', version: '1.0.0'}, user.userUnMute);

        apiRouter.get({path: '/users/:username/report', version: '1.0.0'}, user.getUserReport);    //INCOMPLETE
        apiRouter.get({path: '/goals/:id/report', version: '1.0.0'}, goals.getGoalReport);   //INCOMPLETE

        //User Activities Feed
        apiRouter.get({path: '/users/:username/activities', version: '1.0.0'}, feed.getUserActivities);

        //Education
        apiRouter.get({path: '/users/:username/educations', version: '1.0.0'}, Education.get);
        apiRouter.post({path: '/users/:username/educations', version: '1.0.0'}, Education.create);
        apiRouter.put({path: '/users/:username/educations/:id', version: '1.0.0'}, Education.update);
        apiRouter.del({path: '/users/:username/educations/:id', version: '1.0.0'}, Education.delete);

        //Works
        apiRouter.get({path: '/users/:username/works', version: '1.0.0'}, Work.get);
        apiRouter.post({path: '/users/:username/works', version: '1.0.0'}, Work.create);
        apiRouter.put({path: '/users/:username/works/:id', version: '1.0.0'}, Work.update);
        apiRouter.del({path: '/users/:username/works/:id', version: '1.0.0'}, Work.delete);

        apiRouter.get({path: '/users/:username/linked-goals', version: '1.0.0'}, goals.getUserLinkedGoals);

        //Contacts
        apiRouter.get({path: '/contacts', version: '1.0.0'}, contacts.get);
        apiRouter.post({path: '/contacts', version: '1.0.0'}, contacts.create);
        apiRouter.del({path: '/contacts', version: '1.0.0'}, contacts.delete);
        apiRouter.del({path: '/contacts/ids', version: '1.0.0'}, contacts.deleteByIds);
        apiRouter.post({path: '/contacts/invite', version: '1.0.0'}, contacts.invite);

        //Skills
        apiRouter.get({path: '/users/:username/skills', version: '1.0.0'}, Skills.get);
        apiRouter.post({path: '/users/:username/skills', version: '1.0.0'}, Skills.create);
        apiRouter.put({path: '/users/:username/skills', version: '1.0.0'}, Skills.update);
        apiRouter.del({path: '/users/:username/skills/:userskills_id', version: '1.0.0'}, Skills.delete);
        //apiRouter.put(  {path: '/users/:username/skills',                         version: '1.0.0'}, user.updateUserSkills);
        //apiRouter.put(  {path: '/users/:username/profile/works/skills/:id',       version: '1.0.0'}, user.deleteUserSkills);

        apiRouter.get({path: '/users/:username/interest', version: '1.0.0'}, user.getInterest);
        apiRouter.post({path: '/users/:username/interest', version: '1.0.0'}, user.addInterest);
        //apiRouter.put(  {path: '/users/:username/interest',                       version: '1.0.0'}, user.updateInterest);
        apiRouter.del({path: '/users/:username/interest/:id', version: '1.0.0'}, user.deleteInterest);

        //apiRouter.get(  {path: '/users/:username/email',                  version: '1.0.0'}, user.getEmailAddress);
        //apiRouter.get('/users/:username/email', user.getEmailAddressSorted); // of sort
        //apiRouter.put(  {path: '/users/:username/email',                  version: '1.0.0'}, user.updateEmailAddress);

        //EXPLORE
        //apiRouter.get(  {path: '/tags?suggestion=&limit=&offset=',        version: '1.0.0'}, tags.search); search APIs are in search controller now
        //apiRouter.get(  {path: '/tags',                                   version: '1.0.0'}, tags.getAll);
        //apiRouter.get(  {path: '/tags/:keyword',                          version: '1.0.0'}, tags.search);   //keyword to searchKeyword
        apiRouter.get({path: '/categories', version: '1.0.0'}, categories.getCategories);
        apiRouter.get({path: '/categories/all', version: '1.0.0'}, categories.getAllCategoriesWithSubcategories);

        apiRouter.get({path: '/categories/:id', version: '1.0.0'}, categories.getCategoryById);
        apiRouter.get({path: '/categories/:categoryName/:tag', version: '1.0.0'}, categories.getGoalsByCategoryAndTag);

        apiRouter.get({path: '/explore/hotnewgoals', version: '1.0.0'}, explore.getHotNewGoals);
        apiRouter.get({path: '/explore/popular-goals', version: '1.0.0'}, explore.getPopularGoals);
        apiRouter.get({path: '/explore/featured-users', version: '1.0.0'}, explore.getFeaturedUsers);
        apiRouter.get({path: '/explore/featured-tags', version: '1.0.0'}, explore.getFeaturedTags); //?offset=:integer&limit=:integer
        apiRouter.get({path: '/explore', version: '1.0.0'}, explore.explore);
        apiRouter.get({path: '/tags/:tagname', version: '1.0.0'}, tags.getGoalsOnTag);
        apiRouter.put({path: '/tags/:id', version: '1.0.0'}, tags.edit);
        apiRouter.post({path: '/tags/new', version: '1.0.0'}, tags.insertUserTags);
        apiRouter.get({path: '/tags/:id/info', version: '1.0.0'}, tags.getTagInfo);
        apiRouter.get({path: '/tags/:id/users', version: '1.0.0'}, tags.getTagUsers);

        //GOAL
        apiRouter.get({path: '/settings/privacy', version: '1.0.0'}, goals.getGoalPrivacyScopeList);
        apiRouter.get({path: '/users/:userName/goals', version: '1.0.0'}, goals.getAllGoalByUser);
        apiRouter.get({path: '/goals/:id', version: '1.0.0'}, goals.getGoal);
        apiRouter.post({path: '/goals', version: '1.0.0'}, goals.create);
        apiRouter.put({path: '/goals/:id', version: '1.0.0'}, goals.update);
        apiRouter.del({path: '/goals/:id', version: '1.0.0'}, goals.delete);
        apiRouter.post({path: '/goals/:id/link', version: '1.0.0'}, goals.link);
        apiRouter.del({path: '/goals/:id/link', version: '1.0.0'}, goals.unlink);
        apiRouter.get({path: '/goals/:id/motivation', version: '1.0.0'}, goals.getMotivationCount);
        apiRouter.post({path: '/goals/:id/motivation', version: '1.0.0'}, goals.addMotivation);
        apiRouter.del({path: '/goals/:id/motivation', version: '1.0.0'}, goals.deleteMotivation);
        apiRouter.get({path: '/goals/:id/achievedLinkedGoal', version: '1.0.0'}, dashboard.achievedLinkedGoals);  //get list of linked achieved goals
        apiRouter.get({path: '/goals/:id/achieved', version: '1.0.0'}, goals.getAchieveGoal);
        apiRouter.put({path: '/goals/:id/achieve', version: '1.0.0'}, goals.achieveGoal);
        apiRouter.post({path: '/goals/:id/follow', version: '1.0.0'}, goals.followGoal);
        apiRouter.del({path: '/goals/:id/follow', version: '1.0.0'}, goals.unfollowGoal);
        apiRouter.get({path: '/goals/:id/feed', version: '1.0.0'}, feed.getGoalFeed);
        apiRouter.get({path: '/listGoal/:id', version: '1.0.0'}, goals.getGoalList);
        apiRouter.get({path: '/goals/:id/linked-goals-me', version: '1.0.0'}, goals.getLinkedGoalsMe);     //my linked goals with this goal
        apiRouter.get({path: '/goals/:id/linked-goals', version: '1.0.0'}, goals.getLinkedGoals);       //forward links
        apiRouter.get({path: '/goals/:id/linked-feed', version: '1.0.0'}, feed.getLinkedGoalFeed);
        apiRouter.get({path: '/mygoals', version: '1.0.0'}, goals.getMyGoals);
        apiRouter.get({path: '/mygoals/links/:gid', version: '1.0.0'}, goals.getMyGoalsByOtherGoalId);
        apiRouter.get({path: '/goals/link/suggestion/:id', version: '1.0.0'}, goals.goalLinkingSuggestion);    //goal linking suggestion based on goal id
        apiRouter.get({path: '/goals/follow/suggestion', version: '1.0.0'}, goals.getSuggestedGoal);         //goal follow suggestions based on user interests

        //Albums
        apiRouter.get({path: '/users/:username/images', version: '1.0.0'}, album.getUserAllImage);
        apiRouter.get({path: '/users/:username/videos', version: '1.0.0'}, album.getUserAllVideo);
        apiRouter.get({path: '/users/:username/audios', version: '1.0.0'}, album.getUserAllAudio);
        apiRouter.get({path: '/goals/:gid/images', version: '1.0.0'}, album.getGoalAllImage);
        apiRouter.get({path: '/goals/:gid/videos', version: '1.0.0'}, album.getGoalAllVideo);
        apiRouter.get({path: '/goals/:gid/audios', version: '1.0.0'}, album.getGoalAllAudio);
        apiRouter.get({path: '/library/image', version: '1.0.0'}, album.showAlbum);            //shows image album acc to query string libraryof = default_goal/default_profile/default_cover
        apiRouter.get({path: '/album/:id', version: '1.0.0'}, album.getAlbum);

        //Privacy
        apiRouter.put({path: '/goals/:id/privacy', version: '1.0.0'}, privacy.changeGoalPrivacy);
        apiRouter.put({path: '/posts/:id/privacy', version: '1.0.0'}, privacy.changePostPrivacy);
        apiRouter.put({path: '/account/privacy', version: '1.0.0'}, privacy.changeProfilePrivacy);

        //Contributions
        apiRouter.get({path: '/goals/:id/contributions', version: '1.0.0'}, feed.getGoalContributionFeed);
        apiRouter.post({path: '/goals/:id/contributions', version: '1.0.0'}, contributions.create);

        //Share
        apiRouter.post({path: '/posts/:id/share', version: '1.0.0'}, posts.sharePost);
        apiRouter.post({path: '/goals/:id/share', version: '1.0.0'}, goals.shareGoal);

        //POST
        apiRouter.get({path: '/postsbyparentid/:id', version: '1.0.0'}, posts.getPostByParentId);
        apiRouter.get({path: '/posts/:id', version: '1.0.0'}, posts.getById);
        apiRouter.post({path: '/posts', version: '1.0.0'}, posts.create);
        apiRouter.put({path: '/posts/:id', version: '1.0.0'}, posts.update);
        apiRouter.del({path: '/posts/:id', version: '1.0.0'}, posts.delete);

        //POST - Follow (For notifications)
        apiRouter.post({path: '/posts/:id/follow', version: '1.0.0'}, notifications.postFollow);
        apiRouter.del({path: '/posts/:id/unfollow', version: '1.0.0'}, notifications.postUnFollow);

        //Post - Comments
        apiRouter.get({path: '/posts/:id/comments', version: '1.0.0'}, comments.getAllComments);
        apiRouter.post({path: '/posts/:id/comments', version: '1.0.0'}, comments.createPostComments);
        apiRouter.get({path: '/posts/comments/:id', version: '1.0.0'}, function () {
        });
        apiRouter.put({path: '/posts/comments/:id', version: '1.0.0'}, comments.updatePostComments);
        apiRouter.del({path: '/posts/comments/:id', version: '1.0.0'}, comments.deletePostComments);

        //Post - Comments - Reply
        apiRouter.get({path: '/posts/comments/:id/replies', version: '1.0.0'}, replies.getAllPostCommentReplies);
        apiRouter.post({path: '/posts/comments/:id/replies', version: '1.0.0'}, replies.createPostCommentReplies);
        apiRouter.put({path: '/posts/comments/replies/:id', version: '1.0.0'}, replies.updatePostCommentReplies);
        apiRouter.del({path: '/posts/comments/replies/:id', version: '1.0.0'}, replies.deletePostCommentReplies);
        //apiRouter.get({path: '/posts/comments/replies/:id',           version: '1.0.0'}, function () {});

        //POST - Motivation
        apiRouter.post({path: '/posts/:id/motivation', version: '1.0.0'}, posts.addMotivation);
        apiRouter.del({path: '/posts/:id/motivation', version: '1.0.0'}, posts.deleteMotivation);

        //Dashboard
        apiRouter.get({path: '/user/:username/linkedgoals', version: '1.0.0'}, dashboard.linkedGoals);
        apiRouter.get({path: '/suggest/users', version: '1.0.0'}, dashboard.suggestUsers);
        apiRouter.post({path: '/suggest/users/ignore', version: '1.0.0'}, dashboard.ignore_suggested_user);

        //Progress
        apiRouter.post({path: '/goals/:id/progress', version: '1.0.0'}, progress.create);

        //Milestones
        apiRouter.post({path: '/goals/:gid/milestones', version: '1.0.0'}, milestone.create);
        apiRouter.get({path: '/goals/:gid/milestones', version: '1.0.0'}, milestone.getAll);
        apiRouter.put({path: '/goals/milestone/:id', version: '1.0.0'}, milestone.update);
        apiRouter.del({path: '/goals/milestone/:id', version: '1.0.0'}, milestone.delete);
        apiRouter.put({path: '/milestones/:id/complete', version: '1.0.0'}, milestone.complete);

        //RESOURCE CENTER
        apiRouter.get({path: '/resource-center', version: '1.0.0'}, ResourceCenterCtrl.index_1_0);
        apiRouter.post({path: '/resource-center', version: '1.0.0'}, ResourceCenterCtrl.create_1_0);
        apiRouter.get({path: '/resource-center/:id', version: '1.0.0'}, ResourceCenterCtrl.show_1_0);
        apiRouter.get({path: '/resource-center/:id/edit', version: '1.0.0'}, ResourceCenterCtrl.edit_1_0);
        apiRouter.put({path: '/resource-center/:id', version: '1.0.0'}, ResourceCenterCtrl.update_1_0);
        apiRouter.del({path: '/resource-center/:id', version: '1.0.0'}, ResourceCenterCtrl.destroy_1_0);

        //SESSION
        //apiRouter.post('/testlogin',    session.testlogin);         //test reusable
        //apiRouter.post('/testregister', session.testregister);      //test reusable

        //Coachmarks Routes
        apiRouter.get({path: '/coachmarks/my', version: '1.0.0'}, CoachmarkCtrl.my_1_0);
        /* post params: cm_id  */
        apiRouter.post({path: '/coachmarks/:id/done', version: '1.0.0'}, CoachmarkCtrl.gotIt_1_0);
        /* post params: cm_id  */

        //######################################### Admin - For Next Release ######################################
        /*apiRouter.get(  {path: '/coachmarks',                           version: '1.0.0'}, CoachmarkCtrl.index_1_0);
         apiRouter.post( {path: '/coachmarks',                           version: '1.0.0'}, CoachmarkCtrl.create_1_0);
         apiRouter.get(  {path: '/coachmarks/:id',                       version: '1.0.0'}, CoachmarkCtrl.show_1_0);
         apiRouter.put(  {path: '/coachmarks/:id',                       version: '1.0.0'}, CoachmarkCtrl.update_1_0);
         apiRouter.del(  {path: '/coachmarks/:id',                       version: '1.0.0'}, CoachmarkCtrl.destroy_1_0);*/

        //SEARCH
        apiRouter.get({path: '/search/tag', version: '1.0.0'}, search.searchTags);     // ?q=abc&limit=2&offset=10
        apiRouter.get({path: '/search/goal', version: '1.0.0'}, search.searchGoals);    // ?q=abc&limit=2&offset=10
        apiRouter.get({path: '/search/user', version: '1.0.0'}, search.searchUsers);    // ?q=abc&limit=2&offset=10
        apiRouter.get({path: '/search/all', version: '1.0.0'}, search.searchAll);      // ?q=abc
        apiRouter.get({path: '/search/user/connections', version: '1.0.0'}, search.searchUsersWithPriority);      // ?q=keyword  //to mention a user

        //List
        apiRouter.get({path: '/posts/:id/motivators', version: '1.0.0'}, lists.getPostMotivator);
        apiRouter.get({path: '/goals/:gid/motivators', version: '1.0.0'}, lists.getGoalMotivator);
        apiRouter.get({path: '/goals/:gid/contributors', version: '1.0.0'}, lists.getGoalContributor);
        apiRouter.get({path: '/goals/:gid/followers', version: '1.0.0'}, lists.getGoalFollowers);
        apiRouter.get({path: '/goals/:gid/linkers', version: '1.0.0'}, lists.getGoalLinkers);

        //Notifications
        apiRouter.get({path: '/notifications', version: '1.0.0'}, notifications.get);
        apiRouter.put({path: '/notifications/seen', version: '1.0.0'}, notifications.seen);
        apiRouter.put({path: '/notifications/read/:id', version: '1.0.0'}, notifications.read);
        apiRouter.put({path: '/notifications/subscribe', version: '1.0.0'}, notifications_push.subscribe);
        apiRouter.put({path: '/chat/notifications/', version: '1.0.0'}, notifications_push.chatNotification);

        //Notifications - Settings
        apiRouter.get({path: '/account/notificationSettings', version: '1.0.0'}, user.notificationSettings);
        apiRouter.put({path: '/account/notificationSettings', version: '1.0.0'}, user.updateNotificationSettings);

        apiRouter.get({path: '/feed', version: '1.0.0'}, feed.get);

        apiRouter.put({path: '/goals/:id/updatecover', version: '1.0.0'}, goals.goalUpdateCover);
        apiRouter.put({path: '/account/updatecover', version: '1.0.0'}, user.userUpdateCover);
        apiRouter.put({path: '/account/updateprofile', version: '1.0.0'}, user.userUpdateProfile);

        //USER PROFILE
        apiRouter.get({path: '/users/:username/connections', version: '1.0.0'}, profile.userConnection);
        apiRouter.get({path: '/users/:username/connections/followers', version: '1.0.0'}, profile.followers);
        apiRouter.get({path: '/users/:username/connections/followings', version: '1.0.0'}, profile.followings);
        apiRouter.get({path: '/users/:username/connections/mutual', version: '1.0.0'}, profile.mutual);
        apiRouter.get({path: '/account/basic', version: '1.0.0'}, profile.basic);

        //SOCIAL INTEGRATION
        apiRouter.post({path: '/auth/facebook', version: '1.0.0'}, socialIntegration.facebook);
        apiRouter.post({path: '/auth/facebook/friends', version: '1.0.0'}, socialIntegration.facebookFriends);
        apiRouter.post({path: '/auth/twitter', version: '1.0.0'}, socialIntegration.twitter);
        apiRouter.post({path: '/auth/twitter/friends', version: '1.0.0'}, socialIntegration.twitterFriends);
        apiRouter.post({path: '/auth/google/contacts', version: '1.0.0'}, socialIntegration.google);
        apiRouter.post({path: '/auth/yahoo/contacts', version: '1.0.0'}, socialIntegration.yahoo);
        apiRouter.post({path: '/auth/hotmail/contacts', version: '1.0.0'}, socialIntegration.hotmail);
        apiRouter.post({path: '/auth/icloud/contacts', version: '1.0.0'}, socialIntegration.icloud);

        //FEEDBACK
        apiRouter.post({path: '/feedback', version: '1.0.0'}, feedback.feedback);
        apiRouter.get({path: '/feedback', version: '1.0.0'}, feedback.getFeedbacks);

        //Test
        apiRouter.get({path: ' /test', version: '1.0.0'}, test.user);

        //TEST
        /*
         apiRouter.post({ path: '/mentioned',                                    version: '1.0.0' }, user.mentionedUsers);
         apiRouter.get( { path: '/test/mention',                                 version: '1.0.0' }, posts.testMentioned);
         apiRouter.get( { path: '/test/getuser',                                 version: '1.0.0' }, test.getUser);
         apiRouter.get( { path: '/test/slang/users',                             version: '1.0.0' }, test.fetchUsersSlangWords);
         apiRouter.get( { path: '/test/slang/goals',                             version: '1.0.0' }, test.fetchGoalsSlangWords);
         apiRouter.get( { path: '/test/notification',                            version: '1.0.0' }, test.emitToastNotification);
         */

        apiRouter.get('/test/contribution', test.testContributionTemplate);

        apiRouter.get('/test/milestone', test.testMilestoneCompletedTemplate);

        apiRouter.get('/test/milestone', test.testGoalLinkedTemplate);

    }
};

//for formatting
String.prototype.format = function (i, safe, arg) {

    function format() {
        var str = this, len = arguments.length + 1;

        // For each {0} {1} {n...} replace with the argument in that position.  If
        // the argument is an object or an array it will be stringified to JSON.
        for (i = 0; i < len; arg = arguments[i++]) {
            safe = typeof arg === 'object' ? JSON.stringify(arg) : arg;
            str = str.replace(RegExp('\\{' + (i - 1) + '\\}', 'g'), safe);
        }
        return str;
    }

    // Save a reference of what may already exist under the property native.
    // Allows for doing something like: if("".format.native) { /* use native */ }
    format.native = String.prototype.format;

    // Replace the prototype property
    return format;

}();

String.prototype.startsWith = function (str) {
    return !this.indexOf(str);
};

String.prototype.trimSpace = function () {
    //trim multiple space into one space
    //var firstTrim = this.trim();
    //var str = this.trim().replace(/ +(?= )/g, '');
    return this.trim().replace(/ +(?= )/g, '');
};

String.prototype.replaceAll = function (search, replacement) {
    var target = this;
    return target.split(search).join(replacement);
};

String.prototype.makeSQLInjectionSafe = function () {
    return this.replaceAll("'", "''");
};

Array.prototype.toURL = function () {
    return this.join('/');
};

Array.prototype.contains = function (a, val) {
    for (var i = 0; i < a.length; i++) {
        if (a[i] == val) {
            return true;
        }
    }
    return false;
};

Array.prototype.unique = function () {
    var a = this.concat();
    for (var i = 0; i < a.length; ++i) {
        for (var j = i + 1; j < a.length; ++j) {
            if (a[i] === a[j])
                a.splice(j--, 1);
        }
    }

    return a;
};
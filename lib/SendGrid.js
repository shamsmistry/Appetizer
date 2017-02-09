var Promise = require("bluebird");
var emailConfig = require('../config/email_config');

exports.sendEmail = function (emailObj) {

    return new Promise(function (resolveSendEmail) {

        var helper = require('sendgrid').mail;
        var mail = new helper.Mail();

        email = new helper.Email(emailObj.from, emailObj.fromname || 'Linkagoal');
        mail.setFrom(email);
        mail.setIpPoolName("transactional");
        var length = 78;
        mail.setSubject(emailObj.subject.substring(0, length));

           //recipients
        if (Array.isArray(emailObj.to)) {
            for (var i = 0, len = emailObj.to.length; i < len; i++) {

                //initialize personalization
                var personalization = new helper.Personalization();

                //email
                email = new helper.Email(emailObj.to[i]);
                personalization.addTo(email);

                //substitution
                Object.keys(emailObj.substitutions).forEach(function (subKey) {
                    personalization.addSubstitution(new helper.Substitution(subKey, emailObj.substitutions[subKey][i]));
                });

                //add personalization to list
                mail.addPersonalization(personalization);
            }
        }
        else {
            email = new helper.Email(emailObj.to);
            personalization.addTo(email);
        }

        //content
        content = new helper.Content("text/html", emailObj.htmlBody);
        //content = new helper.Content("text/html", '<h1>chal jaaaaaaaaaaaaaaa</h1>');
        mail.addContent(content);

        mail.setTemplateId(emailObj.templateId);

        //substitution
        /*Object.keys(emailObj.substitutions).forEach(function (subKey) {
            for (var index = 0; index < emailObj.substitutions[subKey].length; index++) {
                //substitution = new helper.Substitution(subKey, emailObj.substitutions[subKey][index]);
                personalization.addSubstitution(new helper.Substitution(subKey, emailObj.substitutions[subKey][index]));
            }
        });*/

        //mail.addPersonalization(personalization);

        var sg = require('sendgrid')(process.env.SENDGRID_API_KEY);
        var requestBody = mail.toJSON();
        var request = sg.emptyRequest();
        request.method = 'POST';
        request.path = '/v3/mail/send';
        request.body = requestBody
        return sg.API(request, function (err, response) {

            if (err)
                console.error('SENDGRID lib - Error: ', err);
            else if (response.statusCode != 202) {
                console.error('error in email - email object', request);
                console.error('------------------------');
                console.error('error in email - SENDGRID response', response);
                console.error('------------------------');
                console.error('error in email - SENDGRID response - errors', JSON.parse(response.body));
            }
             else{
                console.log(response.statusCode);
            }
        });

    }).then(function (result) {
        return result;
    });
};


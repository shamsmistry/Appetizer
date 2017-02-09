
module.exports =  function (sequelize,DataTypes) {

    var sessions = sequelize.define(
        'sessions',
        {
            //mapping coulumns i-e datatypes, null checks etc
            SessionId: {autoIncrement: true, type: DataTypes.INTEGER(11), allowNull: false, primaryKey: true},
            uid: { type: DataTypes.INTEGER(11), allowNull: false },
            clientid: { type: DataTypes.STRING, allowNull: false },
            clientsecret: { type: DataTypes.STRING, allowNull: false },
            token: { type: DataTypes.STRING, allowNull: true },
            status: { type: DataTypes.ENUM('ACTIVE', 'INACTIVE'), allowNull: true, defaultValue: 'ACTIVE' },
            uuid: { type: DataTypes.STRING(255), allowNull: true },
            device_subscription_token: { type: DataTypes.STRING(500), allowNull: true },
            platform: { type: DataTypes.STRING(50), allowNull: true },
            platform_version: { type: DataTypes.STRING(10), allowNull: true },
            model: { type: DataTypes.STRING(15), allowNull: true },
            mobile: { type: DataTypes.BOOLEAN, allowNull: true },
            isRetina: { type: DataTypes.BOOLEAN, allowNull: true },
            screen_width: { type: DataTypes.INTEGER(6), allowNull: true },
            screen_height: { type: DataTypes.INTEGER(6), allowNull: true },
            useragent: {type: DataTypes.STRING, allowNull: true},
            created: { type: DataTypes.INTEGER(11), allowNull: false },
            expireTime: { type: DataTypes.INTEGER(11), allowNull: false },            
            locationId: { type: DataTypes.INTEGER(11), allowNull: true }            
        },
        {
            timestamps: false,
            paranoid: true,
            freezeTableName: true,
            tableName: 'sessions',
            classMethods: {
                associate: function(models) {
                    sessions.belongsTo(models.users, { foreignKey: 'uid'} );
                }
            }
        }
    );
    return sessions;
};
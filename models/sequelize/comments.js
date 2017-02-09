module.exports = function (sequelize, DataTypes) {

    var comments = sequelize.define(
        'comments',
        {
            //mapping coulumns i-e datatypes, null checks etc
            id: {autoIncrement: true, type: DataTypes.INTEGER(11), allowNull: false, primaryKey: true},
            parent_id: {type: DataTypes.INTEGER(11), allowNull: false},
            uid: {type: DataTypes.INTEGER(11), allowNull: false},            
            comment_txt: {type: DataTypes.TEXT, allowNull: false},
            parent_type: {type: DataTypes.ENUM('POST'), allowNull: false},
            comment_type: {type: DataTypes.ENUM('TEXT', 'AUDIO', 'VIDEO', 'IMAGE'), allowNull: true},
            fetched_url_id: {type: DataTypes.INTEGER(11), allowNull: true},
            file_id: {type: DataTypes.INTEGER(11), allowNull: true},
            image_id: {type: DataTypes.INTEGER(11), allowNull: true},
            scope: {type: DataTypes.ENUM('PUBLIC'), allowNull: false},
            status: {type: DataTypes.ENUM('ACTIVE', 'DELETED', 'USERDEACTIVATED'), allowNull: false},
            created: {type: DataTypes.INTEGER(11), allowNull: false},
            updated: {type: DataTypes.INTEGER(11), allowNull: true},

            //derived attributes
            user: { type: DataTypes.VIRTUAL },
            image: { type: DataTypes.VIRTUAL },
            mentionList: { type: DataTypes.VIRTUAL }
        },
        {
            timestamps: false,
            paranoid: true,
            freezeTableName: true,
            tableName: 'comments',
            classMethods: {
                associate: function(models) {
                    comments.belongsTo(models.fetched_url, { targetKey: 'id', foreignKey : 'fetched_url_id'});
                }
            }
        }
    );
    return comments;
};
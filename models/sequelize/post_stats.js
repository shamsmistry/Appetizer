module.exports  = function (sequelize, DataTypes) {
    var post_stats = sequelize.define(
        'post_stats',
        {
            //mapping coulumns i-e datatypes, null checks etc
            id: { autoIncrement: true, type: DataTypes.INTEGER, allowNull: false, primaryKey: true },
            post_id: { type: DataTypes.INTEGER(11), allowNull: false },
            motivations: { type: DataTypes.INTEGER(11), allowNull: false },
            comments: { type: DataTypes.INTEGER(11), allowNull: false },
            shares: { type: DataTypes.INTEGER(11), allowNull: false },
            views: { type: DataTypes.INTEGER(11), allowNull: false }
        },
        {
            timestamps: false,
            paranoid: true,
            freezeTableName: true,
            tableName: 'post_stats',
            classMethods: {
                associate: function(models) {
                    post_stats.belongsTo(models.posts, { foreignKey: 'post_id'} );
                }
            }
        }
    );

    return post_stats;
};

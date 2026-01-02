module.exports = app => {
  const { INTEGER, STRING, DATE } = app.Sequelize

  const TeamPrompt = app.model.define(
    'team_prompt',
    {
      id: {
        type: INTEGER,
        primaryKey: true,
        autoIncrement: true,
        comment: '团队提示词配置ID',
      },
      title: {
        type: STRING(200),
        allowNull: false,
        defaultValue: '未命名团队提示词',
        comment: '团队提示词配置标题',
      },
      created_at: {
        type: DATE,
        allowNull: false,
      },
      updated_at: {
        type: DATE,
        allowNull: false,
      },
      deleted_at: {
        type: DATE,
        allowNull: true,
      },
    },
    {
      tableName: 'team_prompts',
      paranoid: true,
      timestamps: true,
      underscored: true,
    },
  )

  // 定义关联关系
  TeamPrompt.associate = function () {
    app.model.TeamPrompt.hasMany(app.model.TeamPromptItem, {
      foreignKey: 'team_prompt_id',
      as: 'items',
    })
  }

  return TeamPrompt
}


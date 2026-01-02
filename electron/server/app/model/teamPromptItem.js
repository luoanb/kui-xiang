module.exports = app => {
  const { INTEGER, STRING, TEXT, BOOLEAN, JSON, DATE } = app.Sequelize

  const TeamPromptItem = app.model.define(
    'team_prompt_item',
    {
      id: {
        type: INTEGER,
        primaryKey: true,
        autoIncrement: true,
        comment: '提示词项ID',
      },
      team_prompt_id: {
        type: INTEGER,
        allowNull: false,
        comment: '关联的团队提示词配置ID',
      },
      prompt_id: {
        type: STRING(100),
        allowNull: false,
        comment: '提示词项ID（前端生成的唯一标识）',
      },
      title: {
        type: STRING(200),
        allowNull: false,
        comment: '提示词项标题',
      },
      content: {
        type: TEXT,
        allowNull: false,
        comment: '提示词内容',
      },
      is_main: {
        type: BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: '是否为主提示词',
      },
      temperature: {
        type: JSON,
        allowNull: true,
        comment: '温度参数数组',
      },
      top_p: {
        type: JSON,
        allowNull: true,
        comment: 'top_p参数数组',
      },
      presence_penalty: {
        type: JSON,
        allowNull: true,
        comment: '存在惩罚参数数组',
      },
      frequency_penalty: {
        type: JSON,
        allowNull: true,
        comment: '频率惩罚参数数组',
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
      tableName: 'team_prompt_items',
      paranoid: true,
      timestamps: true,
      underscored: true,
    },
  )

  // 定义关联关系
  TeamPromptItem.associate = function () {
    app.model.TeamPromptItem.belongsTo(app.model.TeamPrompt, {
      foreignKey: 'team_prompt_id',
      as: 'teamPrompt',
    })
  }

  return TeamPromptItem
}


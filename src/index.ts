import { definePlugin } from '@qqbot/sdk'

interface Config { characters: string }

export default definePlugin<Config>({
  name: 'character-draw',
  apiVersion: 1,
  displayName: '随机抽角色',
  description: '群里单独 @ 机器人时随机抽取一个角色。',
  configSchema: {
    type: 'object',
    properties: {
      characters: {
        type: 'string',
        format: 'textarea',
        title: '角色列表',
        description: '每行一个角色，格式：角色名 | 图片直链；没有图片时只写名字。',
      },
    },
  },
  defaultConfig: { characters: '太刀侠\n0大人\n蒸蛋\n邦尼\n雪莉\n露露\n蓝海晴' },
  events: {
    'qq.group.robot_added': () => '哼哼，我是由美咕噜超可爱会长设计的吉星派对看板娘喵，大家可以@我来抽角色玩',
    'qq.group.member_added': async ({ session, ctx }) => {
      if (!session.userId) {
        ctx.logger.warn('群成员加入事件缺少成员标识，无法发送欢迎语')
        return
      }
      const text = '看板娘在这里欢迎新人进群喵，可以@我来抽角色玩喵'
      const result = await session.send({ text, markdown: { content: `<qqbot-at-user id="${session.userId}" />，${text}` } })
      if (!result.ok) ctx.logger.warn('欢迎新人消息发送失败', { status: result.status, error: result.error })
    },
    'qq.group.at_message': async ({ session, ctx }) => {
      if (!session.atMe || session.addressedToOthers) return
      const content = session.content.trim()
      if (content && !/^(?:抽角色|换一个)[\s！!。.?？]*$/.test(content)) {
        return '当前看板娘只支持抽角色喵'
      }
      const entries = ctx.config.characters.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
      if (!entries.length) return '角色池还是空的，请在机器人面板中添加角色。'
      const [name, image] = entries[Math.floor(Math.random() * entries.length)]!.split('|').map(s => s.trim())
      if (!name) return '角色配置有误，请在面板中检查。'
      if (!image || !/^https:\/\//i.test(image)) return `你抽到了：${name}`
      const result = await session.reply({ text: `你抽到了：${name}`, image: { url: image } })
      if (!result.ok) return `你抽到了：${name}（图片发送失败，请再试一次喵）`
    },
  },
})

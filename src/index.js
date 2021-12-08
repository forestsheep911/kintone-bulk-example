import { KintoneRestAPIClient } from '@kintone/rest-api-client'

const APP_ID = '16'
const BASE_URL = 'https://cndevqpofif.cybozu.cn'
const API_TOKEN = 'DlgJByaoxRaeF3hQlnmj0pgkiEYfAt6uwk0TmNVm'

const client = new KintoneRestAPIClient({
  baseUrl: BASE_URL,
  auth: {
    apiToken: API_TOKEN,
  },
})

// 使用SDK的方式批量获取数据,它会根据情况自动选择最优的方式。
// 不需要用户根据数据规模等情况来判断如何选择使用“记录ID法”、“游标法”、或“offset法”。
// 如果出现游标达到上限的提示，请加上 withCursor: false
async function getBulktRecordsViaSDK() {
  const queryParam = {
    app: APP_ID,
    fields: ['fd_content'],
    condition: '$id < 501',
    orderBy: 'fd_content',
    // withCursor: false,
  }
  const result = await client.record.getAllRecords(queryParam)
  return result
}

// 使用游标的方法批量获取数据
// 一万条以上请选此方法
// 如果出现游标达到上限的提示，请考虑其他方法
async function getBulktRecordsViaCursor() {
  /*
   * get all records function by cursor id sample program
   * Copyright (c) 2019 Cybozu
   *
   * Licensed under the MIT License
   */
  // 创建游标
  async function postCursor(_params) {
    const MAX_READ_LIMIT = 500
    const params = _params || {}
    const app = params.app || kintone.app.getId()
    const { filterCond } = params
    const { sortConds } = params
    const { fields } = params
    const conditions = []
    if (filterCond) {
      conditions.push(filterCond)
    }
    const sortCondsAndLimit = sortConds && sortConds.length > 0 ? ` order by ${sortConds.join(', ')}` : ''
    const query = conditions.join(' and ') + sortCondsAndLimit
    const body = {
      app,
      query,
      size: MAX_READ_LIMIT,
    }
    if (fields && fields.length > 0) {
      body.fields = fields
    }
    const r = await kintone.api(kintone.api.url('/k/v1/records/cursor', true), 'POST', body)
    return r.id
  }
  // 从创建的游标中获取记录
  async function getRecordsByCursorId(_params) {
    const params = _params || {}
    const { id } = params
    let { data } = params
    if (!data) {
      data = {
        records: [],
      }
    }
    const body = {
      id,
    }
    const r = await kintone.api(kintone.api.url('/k/v1/records/cursor', true), 'GET', body)
    data.records = data.records.concat(r.records)
    if (r.next) {
      return getRecordsByCursorId({ id, data })
    }
    return data
  }
  /*
   * @param {Object} params
   *   - app {String}: 应用ID（省略时表示当前打开的应用）
   *   - filterCond {String}: 筛选条件
   *   - sortConds {Array}: 排序条件的数组
   *   - fields {Array}: 要获取的字段的数组
   * @return {Object} response
   *   - records {Array}: 要获取的记录的数组
   */
  async function getRecords(_params) {
    const id = await postCursor(_params)
    return getRecordsByCursorId({ id })
  }
  /*
   * call getRecords function sample program
   * Copyright (c) 2019 Cybozu
   *
   * Licensed under the MIT License
   */
  const params = {
    app: APP_ID,
    filterCond: '$id < 501',
    sortConds: ['fd_content asc'],
    fields: ['fd_content'],
  }
  const result = await getRecords(params)
  return result.records
}

// 使用offset的方法批量获取数据
// 一万条以上避免使用
// 如其他方法可用尽量避免此方法，因为性能较劣
async function getBulktRecordsViaOffset() {}

// 使用记录ID的方法批量获取数据
// 不需要
async function getBulktRecordsViaId() {}
kintone.events.on('app.record.index.show', async (event) => {
  const myContainer = kintone.app.getHeaderSpaceElement()
  myContainer.innerHTML = '<div class="app"><h1>Hello, kintone!</h1></div>'
  // 1. SDK
  // const result = await getBulktRecordsViaSDK()
  // console.log(result.length)
  // 2. 游标
  // const result = await getBulktRecordsViaCursor()
  // console.log(result.length)
  const result = await getBulktRecordsViaOffset()
  console.log(result.length)
  return event
})

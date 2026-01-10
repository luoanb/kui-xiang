
/**
 * 创建一个内存缓存池，缓存使用要慎重考虑有效期，即什么时候需要清除缓存，由使用者自行控制
 * @param updateValueCall [异步方法]获取最新数据的方法,可以先不传,而是在必要时调用init方法传
 * @returns
 */
function CacheCreateor(
  updateValueCall
) {
  let call = updateValueCall;
  let values = {};
  /** 取数据
   * @param key 键
   * @param force 不走缓存，强制获取最新数据
   */
  const getValue = async (key, force = false) => {
    if (force || typeof values[key] === "undefined") {
      if (call) {
        return await call(key);
      }
      throw new Error("CacheCreateor: 未定义获取数据方法");
    }
    return values[key];
  };
  /** 清除缓存 */
  const clean = () => {
    values = {};
  };
  /**
   * 重新定义取数方法，并清除缓存
   * @param updateValueCall 获取最新数据的方法
   */
  const init = (updateValueCall) => {
    call = updateValueCall;
    values = {};
  };
  return {
    init,
    getValue,
    clean,
  };
}

exports.CacheCreateor = CacheCreateor;
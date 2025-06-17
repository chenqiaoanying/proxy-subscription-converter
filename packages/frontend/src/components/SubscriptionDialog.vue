<script setup lang="ts">
import {ref} from 'vue';
import {Proxy} from '@psc/common';
import axios from 'axios';
import { ElMessage } from 'element-plus';

const dialogVisible = defineModel<boolean>("dialogVisible");
const subscribeUrl = ref("");

const emit = defineEmits<{
  (e: 'subscriptionAdd', url: string, proxies: Proxy[]): void
}>();

function onConfirm() {
  if (!subscribeUrl.value) {
    ElMessage.error('请输入订阅链接');
    return;
  }

  axios.get(subscribeUrl.value)
    .then(response => {
      try {
        const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
        if (Array.isArray(data.outbounds)) {
          let proxies = (data.outbounds as Record<string,any>[]).map(outbound => new Proxy(outbound));
          emit('subscriptionAdd', subscribeUrl.value, proxies);
          dialogVisible.value = false;
        } else {
          ElMessage.error('响应中不存在代理信息');
        }
      } catch (error) {
        console.error('解析响应失败:', error);
        ElMessage.error('解析响应失败，请检查数据格式');
        return;
      }
    })
    .catch(error => {
      console.error('获取代理列表失败:', error);
      ElMessage.error('获取代理列表失败，请检查链接或网络');
    });
}

</script>

<template>
  <el-dialog title="添加订阅链接" v-model="dialogVisible">
    <el-form label-width="100px">
      <el-form-item label="订阅链接">
        <el-input v-model="subscribeUrl" placeholder="请输入订阅链接"></el-input>
      </el-form-item>
    </el-form>
    <template #footer>
      <div class="dialog-footer">
        <el-button type="primary" @click="onConfirm">确 定</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">

</style>
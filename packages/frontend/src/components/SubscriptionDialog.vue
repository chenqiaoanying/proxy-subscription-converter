<script setup lang="ts">
import {ref} from 'vue';
import {ElMessage} from 'element-plus';
import {useSubscriptionStore} from "@/stores.ts";

const dialogVisible = defineModel<boolean>("dialogVisible");
const url = ref("");
const userAgent = ref("proxy-subscribe-converter");
const name = ref(crypto.randomUUID());

function onConfirm() {
  if (!url.value) {
    ElMessage.error('请输入订阅链接');
    return;
  }
  useSubscriptionStore().loadAndSaveProxy(name.value, url.value, userAgent.value)
      .then(() => dialogVisible.value = false)
      .catch((err: Error) => {
        ElMessage.error(err.message);
      });
}

</script>

<template>
  <el-dialog title="添加订阅链接" v-model="dialogVisible">
    <el-form label-width="100px">
      <el-form-item label="名称">
        <el-input v-model="name" placeholder="请输入订阅名称"></el-input>
      </el-form-item>
      <el-form-item label="链接">
        <el-input v-model="url" placeholder="请输入订阅链接"></el-input>
      </el-form-item>
      <el-form-item label="用户代理">
        <el-input v-model="userAgent" placeholder="请输入用户代理"></el-input>
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
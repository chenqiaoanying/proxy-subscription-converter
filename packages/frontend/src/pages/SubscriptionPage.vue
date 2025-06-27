<script setup lang="ts">
import {onMounted, ref} from "vue";
import SubscriptionDialog from "@components/SubscriptionDialog.vue";
import {subscriptionsStore} from "@/stores.ts";
import { storeToRefs } from 'pinia';

const store = subscriptionsStore();
const subscriptions = storeToRefs(store).subscriptions;
const addSubscriptionDialogVisible = ref(false);

onMounted(() => {
  // 从后端获取订阅列表
  store.forceReloadSubscriptions();
})
</script>
<template>
  <el-row justify="end">
    <el-button type="primary" @click="addSubscriptionDialogVisible = true">添加订阅链接</el-button>
    <SubscriptionDialog v-model:dialog-visible="addSubscriptionDialogVisible"/>
  </el-row>
  <el-divider/>
  <el-row>
    <!--卡片列表，每个卡片显示一个订阅链接，点击卡片可以查看订阅内容-->
    <el-card v-for="item in subscriptions">
      <template #header>
          <span>{{ item.name }}</span>
      </template>
      <div class="card-content">
        <el-progress v-if="item.dataUsage" type="line" :percentage="(item.dataUsage?.download + item.dataUsage?.upload)/item.dataUsage?.total * 100" />
        <el-progress v-else type="line" :percentage="100" />
      </div>
    </el-card>
  </el-row>
</template>

<style scoped lang="scss">
.el-card {
  width: 300px;
  height: 300px;
  margin: 10px;
}
</style>
<script setup lang="ts">
import {onMounted, ref} from "vue";
import SubscriptionDialog from "@components/SubscriptionDialog.vue";
import {useSubscriptionStore} from "@/stores.ts";
import { storeToRefs } from 'pinia';
import {ElMessage} from "element-plus";
import { Delete, Edit } from '@element-plus/icons-vue';

const store = useSubscriptionStore();
const subscriptions = storeToRefs(store).subscriptions;
const dialogVisible = ref(false);

onMounted(() => {
  store.forceReloadSubscriptions()
      .catch(err => {
        ElMessage.error(err.message);
      });
})
</script>
<template>
  <el-row justify="end">
    <el-button type="primary" @click="dialogVisible = true">添加订阅链接</el-button>
    <SubscriptionDialog v-model:visible="dialogVisible"/>
  </el-row>
  <el-divider/>
  <el-row>
    <el-card v-for="item in subscriptions">
      <template #header>
          <span>{{ item.name }}</span>
      </template>
      <div class="card-content">
        <el-progress v-if="item.dataUsage" type="line" :percentage="(item.dataUsage?.download + item.dataUsage?.upload)/item.dataUsage?.total * 100" />
        <el-progress v-else type="line" :percentage="100" />
      </div>
      <template #footer>
        <el-button type="primary" @click="dialogVisible = true" :icon="Edit"/>
        <el-button type="primary" @click="store.deleteSubscription(item.id)" :icon="Delete"/>
      </template>
    </el-card>
  </el-row>
</template>

<style scoped lang="scss">
.el-card {
  width: 300px;
  margin: 10px;
}
</style>
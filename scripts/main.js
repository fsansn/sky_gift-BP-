import { world, system, ItemStack } from "@minecraft/server";

const CHECK_INTERVAL = 5;
const SEARCH_RADIUS = 40;
const SEARCH_RADIUS_SQ = SEARCH_RADIUS * SEARCH_RADIUS;

const MAX_GIFTS = 10;
const GIFT_LIFETIME = 12000;

const GIFT_TAG = "gift";
const GIFT_TIME_PREFIX = "gift_time_";

const lastChunk = new Map();

system.runInterval(() => {

    const overworld = world.getDimension("minecraft:overworld");
    const spawnY = overworld.heightRange.max - 1;
    const currentTick = world.getAbsoluteTime();

    cleanupOldGifts(overworld, currentTick);

    for (const player of world.getPlayers()) {

        if (player.dimension.id !== "minecraft:overworld") {
            continue;
        }

        const chunkX = Math.floor(player.location.x / 16);
        const chunkZ = Math.floor(player.location.z / 16);

        const prev = lastChunk.get(player.id);

        if (
            prev &&
            prev.x === chunkX &&
            prev.z === chunkZ
        ) {
            continue;
        }

        lastChunk.set(player.id, {
            x: chunkX,
            z: chunkZ
        });

        if (giftExistsNearby(overworld, player.location)) {
            continue;
        }

        const angle = Math.random() * Math.PI * 2;
        const distance = Math.sqrt(Math.random()) * SEARCH_RADIUS;

        const spawnPos = {
            x: player.location.x + Math.cos(angle) * distance,
            y: spawnY,
            z: player.location.z + Math.sin(angle) * distance
        };

        try {

            const gift = overworld.spawnEntity(
                "minecraft:armor_stand",
                spawnPos
            );

            gift.addTag(GIFT_TAG);
            gift.addTag(
                `${GIFT_TIME_PREFIX}${currentTick}`
            );

            const gifts = [
                ...overworld.getEntities({
                    type: "minecraft:armor_stand",
                    tags: [GIFT_TAG]
                })
            ];

            gifts.sort((a, b) => getGiftTime(a) - getGiftTime(b));

            while (gifts.length > MAX_GIFTS) {
                const oldest = gifts.shift();

                try {
                    oldest.remove();
                } catch {}
            }

        } catch {}
    }

}, CHECK_INTERVAL);


// ギフトを攻撃したら開封
world.afterEvents.entityHitEntity.subscribe((event) => {

    const gift = event.hitEntity;

    if (!gift) {
        return;
    }

    if (!gift.hasTag(GIFT_TAG)) {
        return;
    }

    openGift(gift);

});
// ギフト開封
function openGift(gift) {

    try {

        const diamond = new ItemStack(
            "minecraft:diamond",
            1
        );

        gift.dimension.spawnItem(
            diamond,
            gift.location
        );

    } catch {}

    try {
        gift.remove();
    } catch {}
}


// 古いギフトを削除
function cleanupOldGifts(dimension, currentTick) {

    const gifts = [
        ...dimension.getEntities({
            type: "minecraft:armor_stand",
            tags: [GIFT_TAG]
        })
    ];

    for (const gift of gifts) {

        const age = currentTick - getGiftTime(gift);

        if (age >= GIFT_LIFETIME) {

            try {
                gift.remove();
            } catch {}

        }
    }
}


// 近くにギフトがあるか
function giftExistsNearby(dimension, location) {

    const gifts = [
        ...dimension.getEntities({
            type: "minecraft:armor_stand",
            tags: [GIFT_TAG]
        })
    ];

    for (const gift of gifts) {

        const dx = gift.location.x - location.x;
        const dz = gift.location.z - location.z;

        const distanceSq =
            dx * dx +
            dz * dz;

        if (distanceSq <= SEARCH_RADIUS_SQ) {
            return true;
        }
    }

    return false;
}


// タグから生成Tick取得
function getGiftTime(entity) {

    for (const tag of entity.getTags()) {

        if (
            tag.startsWith(GIFT_TIME_PREFIX)
        ) {
            return Number(
                tag.substring(
                    GIFT_TIME_PREFIX.length
                )
            );
        }
    }

    return 0;
}